import { describe, it, expect, vi } from "vitest";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import {
  approveRefundRequest,
  declineRefundRequest,
  raiseRefundRequest,
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
  raise,
  setUpRefundFixtures,
} from "./fixtures.server";

setUpRefundFixtures();

describe("the Refund Request Notifications", () => {
  const testUser = {
    name: "Test User",
    email: "test@example.com",
    avatarUrl: null,
  };

  function sentOf(kind: string) {
    return notifications.sent.filter((n) => n.kind === kind);
  }

  it("confirms the Refund Request to the buyer", async () => {
    const purchase = buyForSelf(base.user.id, 3, 7900);

    const id = await raise(purchase.id, base.user.id);

    expect(sentOf("refund-requested")).toEqual([
      {
        kind: "refund-requested",
        idempotencyKey: `refund-requested:${id}`,
        recipient: { id: base.user.id, ...testUser },
        data: {
          refundRequestId: id,
          courseTitle: "Test Course",
          amount: "$79.00",
        },
      },
    ]);
  });

  it("tells every Platform Admin, and nobody else, about the Open Refund Request", async () => {
    const sam = db
      .insert(schema.users)
      .values({
        name: "Sam Admin",
        email: "sam@example.com",
        role: UserRole.Admin,
      })
      .returning()
      .get();
    const purchase = buyForSelf(base.user.id, 3, 7900);

    const id = await raise(purchase.id, base.user.id);

    const open = sentOf("refund-request-open");
    expect(open.map((n) => n.recipient.id).sort()).toEqual(
      [platformAdmin.id, sam.id].sort()
    );
    expect(open[0]).toEqual({
      kind: "refund-request-open",
      idempotencyKey: `refund-request-open:${id}`,
      recipient: {
        id: platformAdmin.id,
        name: "Pat Admin",
        email: "pat@example.com",
        avatarUrl: null,
      },
      actor: { id: base.user.id, ...testUser },
      data: {
        refundRequestId: id,
        buyerName: "Test User",
        courseTitle: "Test Course",
        amount: "$79.00",
        reason: "It was not what I expected.",
        url: "/admin/refunds",
      },
    });
  });

  it("tells the buyer their Individual Purchase refund was approved", async () => {
    const purchase = buyForSelf(base.user.id, 3, 7900);
    const id = await raise(purchase.id, base.user.id);

    await approveRefundRequest(
      db,
      id,
      platformAdmin.id,
      "Sorry it didn't work out.",
      NOW,
      notifications
    );

    expect(sentOf("refund-approved")).toEqual([
      {
        kind: "refund-approved",
        idempotencyKey: `refund-approved:${id}`,
        recipient: { id: base.user.id, ...testUser },
        actor: {
          id: platformAdmin.id,
          name: "Pat Admin",
          email: "pat@example.com",
          avatarUrl: null,
        },
        data: {
          refundRequestId: id,
          courseTitle: "Test Course",
          purchaseKind: "individual_purchase",
          amount: "$79.00",
          decisionNote: "Sorry it didn't work out.",
          url: "/settings",
        },
      },
    ]);
  });

  it("tells a Team Admin their Team Licence refund was declined", async () => {
    const priya = addStudent("Priya");
    const { purchase } = buySeats(priya.id, 2);
    const id = await raise(purchase.id, priya.id);

    await declineRefundRequest(
      db,
      id,
      platformAdmin.id,
      "  Seats are in use.  ",
      NOW,
      notifications
    );

    expect(sentOf("refund-declined")).toEqual([
      {
        kind: "refund-declined",
        idempotencyKey: `refund-declined:${id}`,
        recipient: {
          id: priya.id,
          name: "Priya",
          email: "priya@example.com",
          avatarUrl: null,
        },
        actor: {
          id: platformAdmin.id,
          name: "Pat Admin",
          email: "pat@example.com",
          avatarUrl: null,
        },
        data: {
          refundRequestId: id,
          courseTitle: "Test Course",
          purchaseKind: "team_licence",
          amount: "$158.00",
          decisionNote: "Seats are in use.",
          url: "/team",
        },
      },
    ]);
    expect(sentOf("refund-approved")).toEqual([]);
  });

  it("tells a Team Admin their Team Licence refund was approved, with no note", async () => {
    const priya = addStudent("Priya");
    const { purchase } = buySeats(priya.id, 2);
    const id = await raise(purchase.id, priya.id);

    await approveRefundRequest(
      db,
      id,
      platformAdmin.id,
      null,
      NOW,
      notifications
    );

    expect(sentOf("refund-approved")).toMatchObject([
      {
        idempotencyKey: `refund-approved:${id}`,
        recipient: { id: priya.id },
        data: {
          purchaseKind: "team_licence",
          decisionNote: null,
          url: "/team",
        },
      },
    ]);
  });

  it("still raises and decides Refund Requests, with their emails, when Knock is down", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    notifications.failWith(new Error("Knock is down"));
    const purchase = buyForSelf(base.user.id);

    const raised = await raiseRefundRequest(
      db,
      purchase.id,
      base.user.id,
      "Nope.",
      NOW,
      notifications
    );
    if (!raised.ok) throw new Error(raised.error);
    const declined = await declineRefundRequest(
      db,
      raised.refundRequestId,
      platformAdmin.id,
      "No.",
      NOW,
      notifications
    );

    expect(raised.email.to).toBe("test@example.com");
    expect(declined).toMatchObject({
      ok: true,
      email: { to: "test@example.com" },
    });
    for (const key of [
      "refund-requested:",
      "refund-request-open:",
      "refund-declined:",
    ]) {
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining(key),
        "Knock is down"
      );
    }
    error.mockRestore();
  });

  it("sends nothing when a decision is refused", async () => {
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
    notifications.sent.length = 0;

    await declineRefundRequest(
      db,
      id,
      platformAdmin.id,
      "Too late.",
      NOW,
      notifications
    );

    expect(notifications.sent).toEqual([]);
  });
});
