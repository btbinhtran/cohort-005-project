import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { CourseStatus, LessonProgressStatus, UserRole } from "~/db/schema";
import { markdown } from "~/lib/text";
import {
  createInstructorAnalytics,
  type AnalyticsViewer,
} from "../index.server";

// Noon UTC keeps every fixture on the same calendar day in local time and in
// UTC, so the refund window (local days) and the chart (UTC days) agree.
export const NOW = new Date("2026-10-06T12:00:00.000Z");
export const DAY_MS = 86_400_000;

export function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

export let db: TestDb;
export let instructor: typeof schema.users.$inferSelect;
export let otherInstructor: typeof schema.users.$inferSelect;
export let admin: typeof schema.users.$inferSelect;
let categoryId: number;
export let course: typeof schema.courses.$inferSelect;
export let otherCourse: typeof schema.courses.$inferSelect;

// Each test file runs this in its own `beforeEach`.
export function setUpFixtures() {
  db = createTestDb();
  const base = seedBaseData(db);
  instructor = base.instructor;
  categoryId = base.category.id;
  course = base.course;
  otherInstructor = addUser("Olive Other", UserRole.Instructor);
  admin = addUser("Pat Admin", UserRole.Admin);
  otherCourse = addCourse(otherInstructor.id, "Other Course");
}

// ─── Fixtures ───
// Nothing else writes most of these tables from a service, so rows go in
// directly. Kept in one place so a schema change touches only this block.

let slugCounter = 0;

export function addUser(name: string, role = UserRole.Student) {
  return db
    .insert(schema.users)
    .values({
      name,
      email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
      role,
    })
    .returning()
    .get();
}

export function addCourse(
  instructorId: number,
  title: string,
  status = CourseStatus.Published
) {
  slugCounter += 1;
  return db
    .insert(schema.courses)
    .values({
      title,
      slug: `course-${slugCounter}`,
      description: title,
      salesCopy: markdown(title),
      instructorId,
      categoryId,
      status,
    })
    .returning()
    .get();
}

export function addModule(courseId: number, title: string, position: number) {
  return db
    .insert(schema.modules)
    .values({ courseId, title, position })
    .returning()
    .get();
}

export function addLesson(moduleId: number, title: string, position: number) {
  return db
    .insert(schema.lessons)
    .values({ moduleId, title, position })
    .returning()
    .get();
}

export function buy(
  userId: number,
  courseId: number,
  amountPaid: number,
  { daysBack = 2, country = "US" as string | null } = {}
) {
  return db
    .insert(schema.purchases)
    .values({
      userId,
      courseId,
      amountPaid,
      country,
      createdAt: daysAgo(daysBack),
    })
    .returning()
    .get();
}

export function buySeats(
  buyerId: number,
  courseId: number,
  seatCount: number,
  amountPaid: number,
  daysBack = 2
) {
  const purchase = buy(buyerId, courseId, amountPaid, { daysBack });
  const team = db.insert(schema.teams).values({}).returning().get();
  const seats = Array.from({ length: seatCount }, (_, index) =>
    db
      .insert(schema.coupons)
      .values({
        teamId: team.id,
        courseId,
        code: `SEAT-${purchase.id}-${index}`,
        purchaseId: purchase.id,
      })
      .returning()
      .get()
  );
  return { purchase, seats };
}

export function enroll(userId: number, courseId: number, daysBack = 2) {
  db.insert(schema.enrollments)
    .values({ userId, courseId, enrolledAt: daysAgo(daysBack) })
    .run();
}

export function claimSeat(
  seat: typeof schema.coupons.$inferSelect,
  userId: number,
  daysBack = 1
) {
  db.update(schema.coupons)
    .set({ redeemedByUserId: userId, redeemedAt: daysAgo(daysBack) })
    .where(eq(schema.coupons.id, seat.id))
    .run();
  enroll(userId, seat.courseId, daysBack);
}

export function rate(
  userId: number,
  courseId: number,
  rating: number,
  daysBack = 2
) {
  db.insert(schema.courseRatings)
    .values({
      userId,
      courseId,
      rating,
      createdAt: daysAgo(daysBack),
      updatedAt: daysAgo(daysBack),
    })
    .run();
}

export function comment(
  lessonId: number,
  userId: number,
  { daysBack = 2, parentId = null as number | null, deleted = false } = {}
) {
  return db
    .insert(schema.comments)
    .values({
      lessonId,
      userId,
      parentId,
      body: markdown("A comment"),
      createdAt: daysAgo(daysBack),
      deletedAt: deleted ? daysAgo(daysBack) : null,
    })
    .returning()
    .get();
}

export function progress(
  userId: number,
  lessonId: number,
  status: LessonProgressStatus
) {
  db.insert(schema.lessonProgress).values({ userId, lessonId, status }).run();
}

export function addQuiz(lessonId: number, title: string, passingScore: number) {
  return db
    .insert(schema.quizzes)
    .values({ lessonId, title, passingScore })
    .returning()
    .get();
}

export function attempt(
  userId: number,
  quizId: number,
  score: number,
  passed: boolean,
  daysBack = 2
) {
  db.insert(schema.quizAttempts)
    .values({ userId, quizId, score, passed, attemptedAt: daysAgo(daysBack) })
    .run();
}

export function analytics(
  viewer: AnalyticsViewer,
  params: Record<string, string> = {}
) {
  return createInstructorAnalytics(db).get(
    viewer,
    new URLSearchParams(params),
    NOW
  );
}

export function asInstructor(params: Record<string, string> = {}) {
  return analytics({ userId: instructor.id, isAdmin: false }, params);
}

export function asAdmin(params: Record<string, string> = {}) {
  return analytics({ userId: admin.id, isAdmin: true }, params);
}
