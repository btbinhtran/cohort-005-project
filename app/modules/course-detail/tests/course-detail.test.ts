import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { createCoursePermissions } from "~/modules/permissions/course-permissions.server";
import type { Person } from "~/modules/permissions/person.server";
import { createCourseDetail } from "../index.server";

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let detail: ReturnType<typeof createCourseDetail>;
let lessonIds: number[];

const NOW = new Date("2026-01-15T12:00:00Z");

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  detail = createCourseDetail(db);

  const mod = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  lessonIds = [1, 2].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: mod.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

// ─── Fixtures ───

function student(): Person {
  return { id: base.user.id, role: "student", country: null };
}

function enrollStudent() {
  db.insert(schema.enrollments)
    .values({ userId: base.user.id, courseId: base.course.id })
    .run();
}

function complete(lessonId: number) {
  db.insert(schema.lessonProgress)
    .values({
      userId: base.user.id,
      lessonId,
      status: schema.LessonProgressStatus.Completed,
    })
    .run();
}

function load(person: Person | null) {
  const decisions = createCoursePermissions(db).decide(person, {
    slug: base.course.slug,
  });
  if (!decisions.found) throw new Error("course not found");
  return detail.loadCoursePage(decisions, NOW);
}

// ─── Tests ───

describe("loadCoursePage", () => {
  it("shows a signed-out visitor the course without progress", async () => {
    const page = await load(null);

    expect(page?.course.title).toBe("Test Course");
    expect(page?.course.modules[0].lessons).toHaveLength(2);
    expect(page?.lessonCount).toBe(2);
    expect(page?.salesCopyHtml).toContain("Sales copy");
    expect(page).toMatchObject({
      enrolled: false,
      canView: false,
      canTake: false,
      progress: 0,
      nextLessonId: null,
      currentUserId: null,
      userRating: null,
      refundOffer: null,
    });
  });

  it("shows an enrolled student their progress and next lesson", async () => {
    enrollStudent();
    complete(lessonIds[0]);

    const page = await load(student());

    expect(page).toMatchObject({
      enrolled: true,
      canView: true,
      canTake: true,
      progress: 50,
      nextLessonId: lessonIds[1],
    });
    expect(page?.lessonProgressMap).toEqual({
      [lessonIds[0]]: schema.LessonProgressStatus.Completed,
    });
  });
});

describe("rateCourse", () => {
  it("records a rating and replaces it on a second rating", async () => {
    enrollStudent();

    detail.rateCourse({
      userId: base.user.id,
      courseId: base.course.id,
      rating: 2,
    });
    detail.rateCourse({
      userId: base.user.id,
      courseId: base.course.id,
      rating: 5,
    });
    const page = await load(student());

    expect(page?.userRating).toBe(5);
    expect(page?.ratingSummary).toEqual({ average: 5, count: 1 });
  });

  it("refuses a rating outside the allowed range", () => {
    expect(() =>
      detail.rateCourse({
        userId: base.user.id,
        courseId: base.course.id,
        rating: 6,
      })
    ).toThrow("Rating must be a whole number");
  });

  it("refuses a rating for a course that does not exist", () => {
    expect(() =>
      detail.rateCourse({ userId: base.user.id, courseId: 9999, rating: 4 })
    ).toThrow("Course not found");
  });
});
