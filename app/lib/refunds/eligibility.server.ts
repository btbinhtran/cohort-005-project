import { and, eq, inArray, sql } from "drizzle-orm";
import {
  lessonProgress,
  lessons,
  modules,
  videoWatchEvents,
  LessonProgressStatus,
  RefundStatus,
} from "~/db/schema";
import {
  REFUND_COMPLETION_LIMIT,
  REFUND_WATCH_LIMIT_SECONDS,
  REFUND_WINDOW_DAYS,
  type RuleBreak,
} from "~/lib/refund-rules";
import {
  getNewestIndividualPurchase,
  getPurchase,
  getRefundRequestWithStatus,
  getSeats,
  isClaimed,
  kindOf,
  type Purchase,
  type Queryable,
} from "./purchases.server";
import { isWithinWindow, lastDayOfWindow } from "./window.server";

// ─── Figures and rules ───

function getLessonIds(db: Queryable, courseId: number): number[] {
  return db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .all()
    .map((row) => row.id);
}

function getCompletedLessonCount(
  db: Queryable,
  userId: number,
  lessonIds: number[]
) {
  if (lessonIds.length === 0) return 0;

  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.status, LessonProgressStatus.Completed),
        inArray(lessonProgress.lessonId, lessonIds)
      )
    )
    .get();

  return result?.count ?? 0;
}

function getSecondsWatched(db: Queryable, userId: number, lessonIds: number[]) {
  if (lessonIds.length === 0) return 0;

  const furthestPerLesson = db
    .select({
      furthest: sql<number>`max(${videoWatchEvents.positionSeconds})`,
    })
    .from(videoWatchEvents)
    .where(
      and(
        eq(videoWatchEvents.userId, userId),
        inArray(videoWatchEvents.lessonId, lessonIds)
      )
    )
    .groupBy(videoWatchEvents.lessonId)
    .all();

  return furthestPerLesson.reduce((total, row) => total + row.furthest, 0);
}

/**
 * How far the buyer has got with what they bought. For an Individual Purchase
 * that is their own progress. A Team Licence gives its buyer nothing to watch,
 * so for one it is how many of its Seats have been claimed.
 */
export type RefundFigures =
  | {
      kind: "individual_purchase";
      lessonsCompleted: number;
      lessonCount: number;
      secondsWatched: number;
    }
  | {
      kind: "team_licence";
      seatCount: number;
      claimedSeatCount: number;
    };

export function getRefundFigures(
  db: Queryable,
  purchase: Purchase
): RefundFigures {
  const seats = getSeats(db, purchase.id);

  if (kindOf(seats) === "team_licence") {
    return {
      kind: "team_licence",
      seatCount: seats.length,
      claimedSeatCount: seats.filter(isClaimed).length,
    };
  }

  const lessonIds = getLessonIds(db, purchase.courseId);
  return {
    kind: "individual_purchase",
    lessonsCompleted: getCompletedLessonCount(db, purchase.userId, lessonIds),
    lessonCount: lessonIds.length,
    secondsWatched: getSecondsWatched(db, purchase.userId, lessonIds),
  };
}

/** What the buyer is told when they can't raise a Refund Request. */
const RULE_BREAK_ERRORS: Record<RuleBreak, string> = {
  window_closed: `The ${REFUND_WINDOW_DAYS}-day window has closed.`,
  watched_too_much: "You have watched too much of this course to get a refund.",
  completed_too_much:
    "You have completed too much of this course to request a refund.",
  seat_claimed: "A Team Licence with a claimed Seat cannot be refunded.",
};

/**
 * The eligibility rules a Purchase breaks. `windowCheckedOn` is the day the
 * window is judged against: today when a buyer asks, and the day it was raised
 * when a Platform Admin looks at a Refund Request.
 */
export function findRuleBreaks(
  purchase: Purchase,
  figures: RefundFigures,
  windowCheckedOn: Date
): RuleBreak[] {
  const breaks: RuleBreak[] = [];

  if (!isWithinWindow(purchase.createdAt, windowCheckedOn)) {
    breaks.push("window_closed");
  }

  if (figures.kind === "team_licence") {
    if (figures.claimedSeatCount > 0) breaks.push("seat_claimed");
    return breaks;
  }

  if (figures.secondsWatched >= REFUND_WATCH_LIMIT_SECONDS) {
    breaks.push("watched_too_much");
  }

  if (
    figures.lessonCount > 0 &&
    figures.lessonsCompleted / figures.lessonCount >= REFUND_COMPLETION_LIMIT
  ) {
    breaks.push("completed_too_much");
  }

  return breaks;
}

export type Failure = {
  ok: false;
  status: 400 | 403 | 404 | 409;
  error: string;
};

type RefundCheck = { ok: true; purchase: Purchase } | Failure;

/**
 * Whether this buyer may raise a Refund Request on this Purchase today. Only
 * the person who paid may, and only one Refund Request can be open at once.
 */
export function checkRefundRequest(
  db: Queryable,
  purchaseId: number,
  buyerId: number,
  now: Date
): RefundCheck {
  const purchase = getPurchase(db, purchaseId);

  if (!purchase || purchase.userId !== buyerId) {
    return { ok: false, status: 404, error: "Purchase not found." };
  }

  if (getRefundRequestWithStatus(db, purchase.id, RefundStatus.Open)) {
    return {
      ok: false,
      status: 409,
      error: "You already have an open refund request on this purchase.",
    };
  }

  if (getRefundRequestWithStatus(db, purchase.id, RefundStatus.Approved)) {
    return {
      ok: false,
      status: 409,
      error: "This purchase has already been refunded.",
    };
  }

  const [firstBreak] = findRuleBreaks(
    purchase,
    getRefundFigures(db, purchase),
    now
  );

  if (firstBreak) {
    return { ok: false, status: 403, error: RULE_BREAK_ERRORS[firstBreak] };
  }

  return { ok: true, purchase };
}

export type RefundOffer = {
  purchaseId: number;
  amount: number;
  lastDayInWindow: string;
};

/**
 * What the course page offers a student who wants their money back: their
 * newest Individual Purchase of the course, if it can be refunded. Team
 * Licences are refunded from the team page instead.
 */
export function getRefundOffer(
  db: Queryable,
  buyerId: number,
  courseId: number,
  now: Date
): RefundOffer | null {
  const individualPurchase = getNewestIndividualPurchase(db, buyerId, courseId);
  if (!individualPurchase) return null;

  const check = checkRefundRequest(db, individualPurchase.id, buyerId, now);
  if (!check.ok) return null;

  return {
    purchaseId: individualPurchase.id,
    amount: individualPurchase.amountPaid,
    lastDayInWindow: lastDayOfWindow(individualPurchase.createdAt),
  };
}
