import { and, eq, isNotNull, isNull } from "drizzle-orm";
import {
  coupons,
  courses,
  enrollments,
  refunds,
  users,
  RefundStatus,
} from "~/db/schema";
import { formatPrice } from "~/lib/utils";
import {
  sendSafely,
  toNotificationPerson,
  type Notifications,
} from "~/lib/notifications.server";
import type { Failure } from "./eligibility.server";
import type { Email } from "./raise.server";
import {
  getPurchase,
  getSeats,
  isClaimed,
  kindOf,
  type Db,
  type Purchase,
  type Queryable,
} from "./purchases.server";

// ─── Deciding a Refund Request ───

export type DecisionResult = { ok: true; email: Email } | Failure;

function findOpenRefundRequest(
  tx: Queryable,
  refundRequestId: number
): { ok: true; purchase: Purchase } | Failure {
  const refundRequest = tx
    .select()
    .from(refunds)
    .where(eq(refunds.id, refundRequestId))
    .get();

  if (!refundRequest) {
    return { ok: false, status: 404, error: "Refund request not found." };
  }

  // The first decision wins. A second Platform Admin deciding the same
  // request lands here and is told what already happened.
  if (refundRequest.status !== RefundStatus.Open) {
    return {
      ok: false,
      status: 409,
      error: `This refund request was already ${refundRequest.status}.`,
    };
  }

  const purchase = getPurchase(tx, refundRequest.purchaseId);
  if (!purchase) {
    return { ok: false, status: 404, error: "Purchase not found." };
  }

  return { ok: true, purchase };
}

/**
 * Approves an Open Refund Request and ends what its Purchase granted.
 *
 * - An Individual Purchase: the buyer loses their Enrollment, unless
 *   they also hold a Claimed Seat for the course (docs/adr/0004). Their progress stays
 *   (docs/adr/0001).
 * - A Team Licence: its Unclaimed Seats can never be claimed. Refused if any
 *   Seat has been claimed (docs/adr/0003).
 */
export async function approveRefundRequest(
  db: Db,
  refundRequestId: number,
  platformAdminId: number,
  note: string | null,
  now: Date,
  notifications: Notifications
): Promise<DecisionResult> {
  const result = db.transaction((tx): DecisionResult => {
    const found = findOpenRefundRequest(tx, refundRequestId);
    if (!found.ok) return found;

    const { purchase } = found;
    const seats = getSeats(tx, purchase.id);

    if (kindOf(seats) === "team_licence") {
      if (seats.some(isClaimed)) {
        return {
          ok: false,
          status: 409,
          error:
            "A Seat on this Team Licence has been claimed, so this refund request can only be declined.",
        };
      }

      tx.update(coupons)
        .set({ refundedAt: now.toISOString() })
        .where(
          and(eq(coupons.purchaseId, purchase.id), isNull(coupons.redeemedAt))
        )
        .run();
    } else {
      const claimedSeat = tx
        .select({ id: coupons.id })
        .from(coupons)
        .where(
          and(
            eq(coupons.redeemedByUserId, purchase.userId),
            eq(coupons.courseId, purchase.courseId),
            isNotNull(coupons.redeemedAt)
          )
        )
        .get();

      if (!claimedSeat) {
        tx.delete(enrollments)
          .where(
            and(
              eq(enrollments.userId, purchase.userId),
              eq(enrollments.courseId, purchase.courseId)
            )
          )
          .run();
      }
    }

    tx.update(refunds)
      .set({
        status: RefundStatus.Approved,
        amountRefunded: purchase.amountPaid,
        decisionNote: note,
        resolvedAt: now.toISOString(),
        resolvedByUserId: platformAdminId,
      })
      .where(eq(refunds.id, refundRequestId))
      .run();

    return {
      ok: true,
      email: buildDecisionEmail(tx, purchase, RefundStatus.Approved, note),
    };
  });

  if (result.ok) await notifyDecision(db, refundRequestId, notifications);
  return result;
}

/**
 * Declines an Open Refund Request. Nothing the Purchase granted is lost, and
 * the buyer may raise a new Refund Request. The note is required: it is how
 * the buyer learns whether another request is worth raising.
 */
export async function declineRefundRequest(
  db: Db,
  refundRequestId: number,
  platformAdminId: number,
  note: string,
  now: Date,
  notifications: Notifications
): Promise<DecisionResult> {
  const trimmedNote = note.trim();

  if (trimmedNote.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Write the buyer a note saying why it was declined.",
    };
  }

  const result = db.transaction((tx): DecisionResult => {
    const found = findOpenRefundRequest(tx, refundRequestId);
    if (!found.ok) return found;

    tx.update(refunds)
      .set({
        status: RefundStatus.Declined,
        decisionNote: trimmedNote,
        resolvedAt: now.toISOString(),
        resolvedByUserId: platformAdminId,
      })
      .where(eq(refunds.id, refundRequestId))
      .run();

    return {
      ok: true,
      email: buildDecisionEmail(
        tx,
        found.purchase,
        RefundStatus.Declined,
        trimmedNote
      ),
    };
  });

  if (result.ok) await notifyDecision(db, refundRequestId, notifications);
  return result;
}

/** The email the buyer gets once their Refund Request is decided. */
function buildDecisionEmail(
  db: Queryable,
  purchase: Purchase,
  decision: RefundStatus.Approved | RefundStatus.Declined,
  note: string | null
): Email {
  const buyer = db
    .select()
    .from(users)
    .where(eq(users.id, purchase.userId))
    .get();
  const course = db
    .select()
    .from(courses)
    .where(eq(courses.id, purchase.courseId))
    .get();

  const courseTitle = course?.title ?? "your course";
  const noteLines = note ? ["", note] : [];

  const middle =
    decision === RefundStatus.Approved
      ? [
          `We have approved your refund request for "${courseTitle}".`,
          `${formatPrice(purchase.amountPaid)}, the full amount you paid, is on its way back to you.`,
          ...noteLines,
        ]
      : [
          `We have looked at your refund request for "${courseTitle}" and decided not to refund it.`,
          ...noteLines,
          "",
          "You still have everything you bought. If something changes, you can raise a new refund request.",
        ];

  return {
    to: buyer?.email ?? "",
    subject: `Refund ${decision} — ${courseTitle}`,
    body: [
      `Hi ${buyer?.name ?? "there"},`,
      "",
      ...middle,
      "",
      "— The Cadence team",
    ].join("\n"),
  };
}

// ─── Notifications ───

/**
 * Tells the buyer how their Refund Request was decided. Reads the decision
 * back after it has committed.
 */
async function notifyDecision(
  db: Db,
  refundRequestId: number,
  notifications: Notifications
) {
  const refundRequest = db
    .select()
    .from(refunds)
    .where(eq(refunds.id, refundRequestId))
    .get();
  if (!refundRequest || refundRequest.status === RefundStatus.Open) return;

  const purchase = getPurchase(db, refundRequest.purchaseId);
  if (!purchase) return;
  const buyer = db
    .select()
    .from(users)
    .where(eq(users.id, purchase.userId))
    .get();
  const course = db
    .select()
    .from(courses)
    .where(eq(courses.id, purchase.courseId))
    .get();
  const decider = refundRequest.resolvedByUserId
    ? db
        .select()
        .from(users)
        .where(eq(users.id, refundRequest.resolvedByUserId))
        .get()
    : undefined;
  if (!buyer || !course) return;

  const purchaseKind = kindOf(getSeats(db, purchase.id));
  const data = {
    refundRequestId,
    courseTitle: course.title,
    purchaseKind,
    amount: formatPrice(purchase.amountPaid),
    url: purchaseKind === "team_licence" ? "/team" : "/settings",
  };
  const recipient = toNotificationPerson(buyer);
  const actor = decider ? toNotificationPerson(decider) : undefined;

  if (refundRequest.status === RefundStatus.Approved) {
    await sendSafely(
      notifications,
      {
        kind: "refund-approved",
        recipient,
        actor,
        data: { ...data, decisionNote: refundRequest.decisionNote },
      },
      `refund-approved:${refundRequestId}`
    );
  } else {
    await sendSafely(
      notifications,
      {
        kind: "refund-declined",
        recipient,
        actor,
        data: { ...data, decisionNote: refundRequest.decisionNote ?? "" },
      },
      `refund-declined:${refundRequestId}`
    );
  }
}
