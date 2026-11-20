import { describe, it, expect } from "vitest";
import {
  checkRefundRequest,
  declineRefundRequest,
  getSeatAvailability,
} from "../refunds.server";
import {
  NOW,
  db,
  base,
  platformAdmin,
  notifications,
  addStudent,
  buyForSelf,
  buySeats,
  isEnrolled,
  raise,
  getSeat,
  setUpRefundFixtures,
} from "./fixtures.server";

setUpRefundFixtures();

describe("declining a Refund Request", () => {
  it("needs a note", async () => {
    const purchase = buyForSelf(base.user.id);
    const id = await raise(purchase.id, base.user.id);

    expect(
      await declineRefundRequest(
        db,
        id,
        platformAdmin.id,
        "  ",
        NOW,
        notifications
      )
    ).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("keeps the buyer's Enrollment and lets them raise a new Refund Request", async () => {
    const purchase = buyForSelf(base.user.id);
    const id = await raise(purchase.id, base.user.id);

    const result = await declineRefundRequest(
      db,
      id,
      platformAdmin.id,
      "You finished the course.",
      NOW,
      notifications
    );

    if (!result.ok) throw new Error(result.error);
    expect(result.email.body).toContain("You finished the course.");
    expect(isEnrolled(base.user.id)).toBe(true);
    expect(checkRefundRequest(db, purchase.id, base.user.id, NOW).ok).toBe(
      true
    );
  });

  it("frees a Team Licence's Seats again", async () => {
    const priya = addStudent("Priya");
    const { purchase, seats } = buySeats(priya.id, 1);
    const id = await raise(purchase.id, priya.id);
    expect(getSeatAvailability(db, getSeat(seats[0].id))).toBe("on_hold");

    await declineRefundRequest(
      db,
      id,
      platformAdmin.id,
      "Seats are in use.",
      NOW,
      notifications
    );

    expect(getSeatAvailability(db, getSeat(seats[0].id))).toBe("available");
  });
});
