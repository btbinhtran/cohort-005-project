import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "~/db/schema";
import { markdown } from "~/lib/text";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import { createLandingPage, FEATURED_COURSE_LIMIT } from "../index.server";

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
});

// ─── Fixtures ───

let courseNumber = 0;

function addCourse(
  overrides: Partial<typeof schema.courses.$inferInsert> = {}
) {
  courseNumber += 1;
  return db
    .insert(schema.courses)
    .values({
      title: `Course ${courseNumber}`,
      slug: `course-${courseNumber}`,
      description: `Description ${courseNumber}`,
      salesCopy: markdown("Sales copy"),
      instructorId: base.instructor.id,
      categoryId: base.category.id,
      status: schema.CourseStatus.Published,
      ...overrides,
    })
    .returning()
    .get();
}

function addLessons(courseId: number, perModule: number[]) {
  perModule.forEach((lessonCount, index) => {
    const mod = db
      .insert(schema.modules)
      .values({ courseId, title: `Module ${index}`, position: index })
      .returning()
      .get();
    for (let position = 0; position < lessonCount; position++) {
      db.insert(schema.lessons)
        .values({ moduleId: mod.id, title: `Lesson ${position}`, position })
        .run();
    }
  });
}

function addInstructor(email: string) {
  return db
    .insert(schema.users)
    .values({ name: email, email, role: schema.UserRole.Instructor })
    .returning()
    .get();
}

function addCategory(slug: string) {
  return db
    .insert(schema.categories)
    .values({ name: slug, slug })
    .returning()
    .get();
}

function load() {
  return createLandingPage(db).load();
}

// ─── Featured courses ───

describe("featured courses", () => {
  it("shows the newest published courses first, up to the limit", () => {
    db.delete(schema.courses).run();
    addCourse({ title: "Oldest", createdAt: "2025-12-01T00:00:00Z" });
    addCourse({ title: "Old", createdAt: "2026-01-01T00:00:00Z" });
    addCourse({ title: "Newest", createdAt: "2026-04-01T00:00:00Z" });
    addCourse({ title: "Middle", createdAt: "2026-03-01T00:00:00Z" });
    addCourse({ title: "Draft", status: schema.CourseStatus.Draft });

    const titles = load().featuredCourses.map((course) => course.title);

    expect(FEATURED_COURSE_LIMIT).toBe(3);
    expect(titles).toEqual(["Newest", "Middle", "Old"]);
  });

  it("leaves out draft and archived courses", () => {
    db.delete(schema.courses).run();
    addCourse({ title: "Draft", status: schema.CourseStatus.Draft });
    addCourse({ title: "Archived", status: schema.CourseStatus.Archived });

    expect(load().featuredCourses).toEqual([]);
  });

  it("carries what a course card needs", () => {
    db.delete(schema.courses).run();
    const course = addCourse({
      title: "Cards",
      coverImageUrl: "/covers/cards.png",
    });
    addLessons(course.id, [2, 3]);

    expect(load().featuredCourses).toEqual([
      {
        id: course.id,
        title: "Cards",
        slug: course.slug,
        description: course.description,
        coverImageUrl: "/covers/cards.png",
        instructorName: "Test Instructor",
        categoryName: "Programming",
        lessonCount: 5,
      },
    ]);
  });

  it("counts each course's own lessons, and zero for a course with none", () => {
    db.delete(schema.courses).run();
    const empty = addCourse({ createdAt: "2026-02-01T00:00:00Z" });
    const full = addCourse({ createdAt: "2026-01-01T00:00:00Z" });
    addLessons(full.id, [4]);

    const counts = load().featuredCourses.map((course) => [
      course.id,
      course.lessonCount,
    ]);

    expect(counts).toEqual([
      [empty.id, 0],
      [full.id, 4],
    ]);
  });
});

// ─── Catalogue stats ───

describe("catalogue stats", () => {
  it("counts published courses, their lessons, instructors and categories", () => {
    const second = addInstructor("second@example.com");
    const design = addCategory("design");
    const a = addCourse({ instructorId: second.id, categoryId: design.id });
    const b = addCourse();
    addLessons(base.course.id, [1]);
    addLessons(a.id, [2, 3]);
    addLessons(b.id, [4]);

    expect(load().stats).toEqual({
      courses: 3,
      lessons: 10,
      instructors: 2,
      categories: 2,
    });
  });

  it("ignores everything that only belongs to unpublished courses", () => {
    const draftOnlyInstructor = addInstructor("draft-only@example.com");
    const draftOnlyCategory = addCategory("draft-only");
    const draft = addCourse({
      status: schema.CourseStatus.Draft,
      instructorId: draftOnlyInstructor.id,
      categoryId: draftOnlyCategory.id,
    });
    addLessons(draft.id, [7]);
    addLessons(base.course.id, [2]);

    expect(load().stats).toEqual({
      courses: 1,
      lessons: 2,
      instructors: 1,
      categories: 1,
    });
  });

  it("is all zeros for an empty catalogue", () => {
    db.delete(schema.courses).run();

    expect(load().stats).toEqual({
      courses: 0,
      lessons: 0,
      instructors: 0,
      categories: 0,
    });
  });
});
