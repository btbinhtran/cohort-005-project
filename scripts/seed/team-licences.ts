import { eq } from "drizzle-orm";
import { db, type Course, type StudentByEmail } from "./db";
import { daysAgo } from "./helpers";
import * as schema from "../../app/db/schema";
import { TeamMemberRole } from "../../app/db/schema";

export function seedTeamLicences({
  studentByEmail,
  course1,
  course3,
}: {
  studentByEmail: StudentByEmail;
  course1: Course;
  course3: Course;
}) {
  // ─── Further team purchases ───
  // Two more seat purchases so team revenue is not a single row, in mixed
  // redemption states: one team most of the way through its seats, one that has
  // bought and redeemed nothing yet.

  function createTeamPurchase(
    adminEmail: string,
    course: typeof course1,
    seats: number,
    codePrefix: string,
    purchasedDaysAgo: number,
    redeemerEmails: string[]
  ) {
    const teamAdmin = studentByEmail(adminEmail);

    const [team] = db
      .insert(schema.teams)
      .values({ createdAt: daysAgo(purchasedDaysAgo) })
      .returning()
      .all();

    db.insert(schema.teamMembers)
      .values({
        teamId: team.id,
        userId: teamAdmin.id,
        role: TeamMemberRole.Admin,
        createdAt: daysAgo(purchasedDaysAgo),
      })
      .run();

    const [purchase] = db
      .insert(schema.purchases)
      .values({
        userId: teamAdmin.id,
        courseId: course.id,
        amountPaid: course.price * seats,
        country: "US",
        createdAt: daysAgo(purchasedDaysAgo),
      })
      .returning()
      .all();

    const teamCoupons = db
      .insert(schema.coupons)
      .values(
        Array.from({ length: seats }, (_, i) => ({
          teamId: team.id,
          courseId: course.id,
          code: `${codePrefix}-${String(i + 1).padStart(2, "0")}`,
          purchaseId: purchase.id,
          createdAt: daysAgo(purchasedDaysAgo),
        }))
      )
      .returning()
      .all();

    // Redeemers named by email, for the reason given at the first team
    // (purchases-and-teams.ts).
    redeemerEmails.forEach((email, i) => {
      const redeemer = studentByEmail(email);
      const redeemedDaysAgo = Math.max(0, purchasedDaysAgo - (i + 1) * 2);

      db.update(schema.coupons)
        .set({
          redeemedByUserId: redeemer.id,
          redeemedAt: daysAgo(redeemedDaysAgo),
        })
        .where(eq(schema.coupons.id, teamCoupons[i].id))
        .run();

      db.insert(schema.teamMembers)
        .values({
          teamId: team.id,
          userId: redeemer.id,
          role: TeamMemberRole.Member,
          createdAt: daysAgo(redeemedDaysAgo),
        })
        .run();

      db.insert(schema.enrollments)
        .values({
          userId: redeemer.id,
          courseId: course.id,
          enrolledAt: daysAgo(redeemedDaysAgo),
        })
        .run();
    });

    return { team, purchase, coupons: teamCoupons };
  }

  // Eight seats on TypeScript, six redeemed.
  createTeamPurchase(
    "ava.nakamura@student.dev",
    course1,
    8,
    "TEAM-TS-NAKAMURA",
    120,
    [
      "noah.blackwood@student.dev",
      "isla.fernandes@student.dev",
      "ethan.okafor@student.dev",
      "mia.lindqvist@student.dev",
      "lucas.moreau@student.dev",
      "zara.haddad@student.dev",
    ]
  );

  // Four seats on Design Systems, bought during launch week, none redeemed yet.
  const novakLicence = createTeamPurchase(
    "marta.novak@student.dev",
    course3,
    4,
    "TEAM-DS-NOVAK",
    4,
    []
  );

  return novakLicence;
}
