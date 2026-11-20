import { eq, isNotNull, isNull } from "drizzle-orm";
import {
  countRows,
  db,
  type Course,
  type StudentByEmail,
  type User,
} from "./db";
import { daysAgo } from "./helpers";
import * as schema from "../../app/db/schema";
import { TeamMemberRole } from "../../app/db/schema";

export function seedPurchasesAndTeam({
  students,
  bossy,
  course1,
  course2,
  studentByEmail,
}: {
  students: User[];
  bossy: User;
  course1: Course;
  course2: Course;
  studentByEmail: StudentByEmail;
}) {
  // ─── Purchases ───
  // Individual purchases for enrolled students

  db.insert(schema.purchases)
    .values({
      userId: students[0].id, // Emma — bought course 1 individually
      courseId: course1.id,
      amountPaid: 7900,
      country: "US",
      createdAt: daysAgo(50),
    })
    .returning()
    .all();

  db.insert(schema.purchases)
    .values({
      userId: students[0].id, // Emma — bought course 2 individually
      courseId: course2.id,
      amountPaid: 5999,
      country: "US",
      createdAt: daysAgo(40),
    })
    .run();

  db.insert(schema.purchases)
    .values({
      userId: students[1].id, // James — bought course 1 with PPP discount (India)
      courseId: course1.id,
      amountPaid: 2500,
      country: "IN",
      createdAt: daysAgo(45),
    })
    .run();

  db.insert(schema.purchases)
    .values({
      userId: students[2].id, // Olivia — bought course 1 individually
      courseId: course1.id,
      amountPaid: 7900,
      country: "US",
      createdAt: daysAgo(35),
    })
    .run();

  db.insert(schema.purchases)
    .values({
      userId: students[4].id, // Sophia — bought course 1 individually
      courseId: course1.id,
      amountPaid: 7900,
      country: "US",
      createdAt: daysAgo(15),
    })
    .run();

  console.log(`Created ${countRows(schema.purchases)} individual purchases.`);

  // ─── Teams, Team Members, and Coupons ───
  // Bossy McBossface bought 5 team seats for course 2; Olivia and Liam redeemed coupons

  const [team1] = db
    .insert(schema.teams)
    .values({ createdAt: daysAgo(30) })
    .returning()
    .all();

  db.insert(schema.teamMembers)
    .values({
      teamId: team1.id,
      userId: bossy.id,
      role: TeamMemberRole.Admin,
      createdAt: daysAgo(30),
    })
    .run();

  // Team purchase by Bossy McBossface for course 2 (5 seats)
  const [teamPurchase] = db
    .insert(schema.purchases)
    .values({
      userId: bossy.id,
      courseId: course2.id,
      amountPaid: 5999 * 5,
      country: "US",
      createdAt: daysAgo(30),
    })
    .returning()
    .all();

  // Generate 5 coupons for the team purchase
  const couponCodes = [
    "TEAM-NODEJS-A1B2C3",
    "TEAM-NODEJS-D4E5F6",
    "TEAM-NODEJS-G7H8I9",
    "TEAM-NODEJS-J0K1L2",
    "TEAM-NODEJS-M3N4O5",
  ];

  const seededCoupons = db
    .insert(schema.coupons)
    .values(
      couponCodes.map((code) => ({
        teamId: team1.id,
        courseId: course2.id,
        code,
        purchaseId: teamPurchase.id,
        createdAt: daysAgo(30),
      }))
    )
    .returning()
    .all();

  // Redeem 2 of the 5 coupons. Redeemers are named by email, not by position in
  // the students array — position would silently re-point these redemptions at
  // different people the moment a student is inserted rather than appended.
  // Both already have an enrolment for course 2 from the enrolments section.
  db.update(schema.coupons)
    .set({
      redeemedByUserId: studentByEmail("olivia.martinez@student.dev").id,
      redeemedAt: daysAgo(30),
    })
    .where(eq(schema.coupons.id, seededCoupons[0].id))
    .run();

  db.update(schema.coupons)
    .set({
      redeemedByUserId: studentByEmail("liam@example.com").id,
      redeemedAt: daysAgo(25),
    })
    .where(eq(schema.coupons.id, seededCoupons[1].id))
    .run();

  console.log(
    `Created 1 team with Bossy McBossface as admin, 1 team purchase, and ${seededCoupons.length} coupons (${countRows(schema.coupons, isNotNull(schema.coupons.redeemedByUserId))} redeemed, ${countRows(schema.coupons, isNull(schema.coupons.redeemedByUserId))} available).`
  );
}
