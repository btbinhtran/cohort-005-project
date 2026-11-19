import { asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { courses, purchases, refunds, users, RefundStatus } from "~/db/schema";
import type { RuleBreak } from "~/lib/refund-rules";
import {
  checkRefundRequest,
  findRuleBreaks,
  getRefundFigures,
  type RefundFigures,
} from "./eligibility.server";
import {
  getSeats,
  isClaimed,
  kindOf,
  type Queryable,
} from "./purchases.server";
import { lastDayOfWindow } from "./window.server";

// ─── Listing Refund Requests ───

const deciders = alias(users, "deciders");

function selectRefundRequests(db: Queryable) {
  return db
    .select({
      id: refunds.id,
      status: refunds.status,
      reason: refunds.reason,
      decisionNote: refunds.decisionNote,
      requestedAt: refunds.requestedAt,
      resolvedAt: refunds.resolvedAt,
      decidedByName: deciders.name,
      purchase: purchases,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      buyerName: users.name,
      buyerEmail: users.email,
    })
    .from(refunds)
    .innerJoin(purchases, eq(refunds.purchaseId, purchases.id))
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .innerJoin(users, eq(purchases.userId, users.id))
    .leftJoin(deciders, eq(refunds.resolvedByUserId, deciders.id));
}

export type RefundRequestForReview = {
  id: number;
  status: RefundStatus;
  reason: string;
  decisionNote: string | null;
  requestedAt: string;
  resolvedAt: string | null;
  decidedByName: string | null;
  buyerName: string;
  buyerEmail: string;
  courseTitle: string;
  courseSlug: string;
  amountPaid: number;
  purchasedAt: string;
  daysSincePurchase: number;
  figures: RefundFigures;
  ruleBreaks: RuleBreak[];
  canApprove: boolean;
};

/**
 * The Refund Requests a Platform Admin reviews, oldest first. The figures are
 * live, not a snapshot from when the request was raised: the buyer keeps the
 * course while it is open, so what matters is how far they have got now.
 */
export function listRefundRequestsForReview(
  db: Queryable,
  status: RefundStatus,
  now: Date
): RefundRequestForReview[] {
  const rows = selectRefundRequests(db)
    .where(eq(refunds.status, status))
    .orderBy(asc(refunds.requestedAt), asc(refunds.id))
    .all();

  return rows.map((row) => {
    const figures = getRefundFigures(db, row.purchase);
    const ruleBreaks = findRuleBreaks(
      row.purchase,
      figures,
      new Date(row.requestedAt)
    );
    const msSincePurchase =
      now.getTime() - new Date(row.purchase.createdAt).getTime();

    return {
      id: row.id,
      status: row.status,
      reason: row.reason,
      decisionNote: row.decisionNote,
      requestedAt: row.requestedAt,
      resolvedAt: row.resolvedAt,
      decidedByName: row.decidedByName,
      buyerName: row.buyerName,
      buyerEmail: row.buyerEmail,
      courseTitle: row.courseTitle,
      courseSlug: row.courseSlug,
      amountPaid: row.purchase.amountPaid,
      purchasedAt: row.purchase.createdAt,
      daysSincePurchase: Math.max(0, Math.floor(msSincePurchase / 86_400_000)),
      figures,
      ruleBreaks,
      // A Claimed Seat belongs to another student, so the only way out of
      // that request is a decline. See docs/adr/0003.
      canApprove:
        row.status === RefundStatus.Open &&
        !ruleBreaks.includes("seat_claimed"),
    };
  });
}

/** A buyer's own Refund Requests, newest first, for their Settings page. */
export function listRefundRequestsForBuyer(db: Queryable, buyerId: number) {
  return selectRefundRequests(db)
    .where(eq(purchases.userId, buyerId))
    .orderBy(desc(refunds.requestedAt), desc(refunds.id))
    .all()
    .map((row) => ({
      id: row.id,
      status: row.status,
      reason: row.reason,
      decisionNote: row.decisionNote,
      requestedAt: row.requestedAt,
      resolvedAt: row.resolvedAt,
      courseTitle: row.courseTitle,
      courseSlug: row.courseSlug,
      amountPaid: row.purchase.amountPaid,
    }));
}

/** A Team Admin's Team Licences, with what the team page needs to refund one. */
export function listTeamLicences(db: Queryable, buyerId: number, now: Date) {
  const bought = db
    .select({
      purchase: purchases,
      courseTitle: courses.title,
      courseSlug: courses.slug,
    })
    .from(purchases)
    .innerJoin(courses, eq(purchases.courseId, courses.id))
    .where(eq(purchases.userId, buyerId))
    .orderBy(desc(purchases.createdAt), desc(purchases.id))
    .all();

  return bought.flatMap(({ purchase, courseTitle, courseSlug }) => {
    const seats = getSeats(db, purchase.id);
    if (kindOf(seats) !== "team_licence") return [];

    const latestRefundRequest = db
      .select({ status: refunds.status, decisionNote: refunds.decisionNote })
      .from(refunds)
      .where(eq(refunds.purchaseId, purchase.id))
      .orderBy(desc(refunds.requestedAt), desc(refunds.id))
      .get();

    return [
      {
        purchaseId: purchase.id,
        courseTitle,
        courseSlug,
        amountPaid: purchase.amountPaid,
        purchasedAt: purchase.createdAt,
        seatCount: seats.length,
        claimedSeatCount: seats.filter(isClaimed).length,
        latestRefundRequest: latestRefundRequest ?? null,
        canRequestRefund: checkRefundRequest(db, purchase.id, buyerId, now).ok,
        lastDayInWindow: lastDayOfWindow(purchase.createdAt),
      },
    ];
  });
}
