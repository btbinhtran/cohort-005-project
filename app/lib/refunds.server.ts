// docs/adr/0001–0004 explain why Refunds work the way they do. The code lives
// in app/lib/refunds/; this file is the entry point callers import.

export type {
  Db,
  PurchaseKind,
  SeatAvailability,
} from "./refunds/purchases.server";
export {
  getNewestIndividualPurchase,
  getSeatAvailability,
} from "./refunds/purchases.server";
export { calendarDay, lastDayOfWindow } from "./refunds/window.server";
export type {
  Failure,
  RefundFigures,
  RefundOffer,
} from "./refunds/eligibility.server";
export {
  checkRefundRequest,
  getRefundOffer,
} from "./refunds/eligibility.server";
export type { Email, RaiseResult } from "./refunds/raise.server";
export { raiseRefundRequest } from "./refunds/raise.server";
export type { RefundRequestForReview } from "./refunds/listing.server";
export {
  listRefundRequestsForBuyer,
  listRefundRequestsForReview,
  listTeamLicences,
} from "./refunds/listing.server";
export type { DecisionResult } from "./refunds/decisions.server";
export {
  approveRefundRequest,
  declineRefundRequest,
} from "./refunds/decisions.server";
