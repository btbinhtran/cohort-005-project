import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "~/db/schema";
import {
  approveRefundRequest,
  getNewestIndividualPurchase,
  getRefundOffer,
} from "../refunds.server";
import {
  NOW,
  daysBefore,
  db,
  base,
  platformAdmin,
  notifications,
  addStudent,
  buyForSelf,
  buySeats,
  raise,
  setUpRefundFixtures,
} from "./fixtures.server";

setUpRefundFixtures();

describe("the newest Individual Purchase of a course", () => {
  it("is the Individual Purchase, not a newer Team Licence", () => {
    const individual = buyForSelf(base.user.id, 3);
    buySeats(base.user.id, 5, 1);

    expect(
      getNewestIndividualPurchase(db, base.user.id, base.course.id)?.id
    ).toBe(individual.id);
  });

  it("is the newest of several Individual Purchases", () => {
    buyForSelf(base.user.id, 5);
    const newer = db
      .insert(schema.purchases)
      .values({
        userId: base.user.id,
        courseId: base.course.id,
        amountPaid: 3950,
        country: "IN",
        createdAt: daysBefore(2),
      })
      .returning()
      .get();

    expect(
      getNewestIndividualPurchase(db, base.user.id, base.course.id)
    ).toMatchObject({ id: newer.id, country: "IN" });
  });

  it("is nothing when the buyer holds only a Team Licence", () => {
    buySeats(base.user.id, 5);

    expect(
      getNewestIndividualPurchase(db, base.user.id, base.course.id)
    ).toBeNull();
  });

  it("is nothing for a Student who only claimed a Seat", () => {
    const teamAdmin = addStudent("Tess");
    const { seats } = buySeats(teamAdmin.id, 2);
    const student = addStudent("Sam");
    db.update(schema.coupons)
      .set({ redeemedByUserId: student.id, redeemedAt: daysBefore(1) })
      .where(eq(schema.coupons.id, seats[0].id))
      .run();

    expect(
      getNewestIndividualPurchase(db, student.id, base.course.id)
    ).toBeNull();
  });
});

describe("the refund offer on the course page", () => {
  it("offers the newest Individual Purchase, not a newer Team Licence", () => {
    const individual = buyForSelf(base.user.id, 3);
    buySeats(base.user.id, 5, 1);

    expect(getRefundOffer(db, base.user.id, base.course.id, NOW)).toMatchObject(
      {
        purchaseId: individual.id,
        amount: 7900,
      }
    );
  });

  it("offers nothing once the purchase has been refunded", async () => {
    const purchase = buyForSelf(base.user.id);
    const id = await raise(purchase.id, base.user.id);
    await approveRefundRequest(
      db,
      id,
      platformAdmin.id,
      null,
      NOW,
      notifications
    );

    expect(getRefundOffer(db, base.user.id, base.course.id, NOW)).toBeNull();
  });
});
