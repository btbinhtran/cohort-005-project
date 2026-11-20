import { and, desc, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { coupons, purchases, refunds, RefundStatus } from "~/db/schema";

export type Db = BetterSQLite3Database<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Queryable = Db | Tx;

export type Purchase = typeof purchases.$inferSelect;
export type Seat = typeof coupons.$inferSelect;

// ─── Purchases and Seats ───

export function getPurchase(db: Queryable, purchaseId: number) {
  return db.select().from(purchases).where(eq(purchases.id, purchaseId)).get();
}

export function getSeats(db: Queryable, purchaseId: number): Seat[] {
  return db
    .select()
    .from(coupons)
    .where(eq(coupons.purchaseId, purchaseId))
    .all();
}

export function isClaimed(seat: Seat) {
  return seat.redeemedAt !== null;
}

// There is no column saying which kind a Purchase is: a Team Licence is the
// Purchase that granted Seats, and every Team Licence grants at least one.
export type PurchaseKind = "individual_purchase" | "team_licence";

export function kindOf(seats: Seat[]): PurchaseKind {
  return seats.length > 0 ? "team_licence" : "individual_purchase";
}

/**
 * A buyer's newest Individual Purchase of a course, or null. Their Team
 * Licences are skipped, and a Student who only claimed a Seat has none. Read
 * by the refund offer and by the playback Country Lock (ADR-0013).
 */
export function getNewestIndividualPurchase(
  db: Queryable,
  buyerId: number,
  courseId: number
): Purchase | null {
  const newestFirst = db
    .select()
    .from(purchases)
    .where(and(eq(purchases.userId, buyerId), eq(purchases.courseId, courseId)))
    .orderBy(desc(purchases.createdAt), desc(purchases.id))
    .all();

  return (
    newestFirst.find(
      (purchase) => kindOf(getSeats(db, purchase.id)) === "individual_purchase"
    ) ?? null
  );
}

export function getRefundRequestWithStatus(
  db: Queryable,
  purchaseId: number,
  status: RefundStatus
) {
  return db
    .select()
    .from(refunds)
    .where(and(eq(refunds.purchaseId, purchaseId), eq(refunds.status, status)))
    .get();
}

export type SeatAvailability = "available" | "claimed" | "on_hold" | "refunded";

/**
 * Whether a Seat can be claimed right now. A Team Licence's Unclaimed Seats are
 * on hold while it has an Open Refund Request, and can never be claimed once
 * that request is approved.
 */
export function getSeatAvailability(
  db: Queryable,
  seat: Seat
): SeatAvailability {
  if (isClaimed(seat)) return "claimed";
  if (seat.refundedAt !== null) return "refunded";
  if (getRefundRequestWithStatus(db, seat.purchaseId, RefundStatus.Open)) {
    return "on_hold";
  }
  return "available";
}
