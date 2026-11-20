import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { CourseStatus, LessonProgressStatus } from "~/db/schema";
import { createCourseEditor } from "../index.server";

let db: TestDb;
let editor: ReturnType<typeof createCourseEditor>;
let base: ReturnType<typeof seedBaseData>;
let courseId: number;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  courseId = base.course.id;
  editor = createCourseEditor(db);
});

function addLesson(moduleId: number, title: string, durationMinutes = 10) {
  return editor.createLesson(
    moduleId,
    title,
    null,
    null,
    null,
    durationMinutes
  );
}

function lessonTitles(moduleId: number) {
  const course = editor.getCourseWithDetails(courseId);
  return course?.modules
    .find((mod) => mod.id === moduleId)
    ?.lessons.map((lesson) => lesson.title);
}

describe("course details", () => {
  it("returns the course with its modules and lessons in position order", () => {
    const second = editor.createModule(courseId, "Second", 2);
    const first = editor.createModule(courseId, "First", 1);
    addLesson(first.id, "Intro");
    addLesson(first.id, "Setup");

    const course = editor.getCourseWithDetails(courseId);

    expect(course?.instructorName).toBe("Test Instructor");
    expect(course?.categoryName).toBe("Programming");
    expect(course?.modules.map((mod) => mod.id)).toEqual([first.id, second.id]);
    expect(lessonTitles(first.id)).toEqual(["Intro", "Setup"]);
    expect(editor.getLessonCountForCourse(courseId)).toBe(2);
  });

  it("returns null for a course that does not exist", () => {
    expect(editor.getCourseWithDetails(9999)).toBeNull();
  });

  it("counts no lessons for a course without modules", () => {
    expect(editor.getLessonCountForCourse(courseId)).toBe(0);
  });

  it("updates the title, status, price and PPP setting", () => {
    editor.updateCourse(courseId, "New title", "New description");
    editor.updateCourseStatus(courseId, CourseStatus.Archived);
    editor.updateCoursePrice(courseId, 4900);
    editor.updateCoursePppEnabled(courseId, false);

    const course = editor.getCourseWithDetails(courseId);
    expect(course).toMatchObject({
      title: "New title",
      description: "New description",
      status: CourseStatus.Archived,
      price: 4900,
      pppEnabled: false,
    });
  });

  it("refuses empty sales copy", () => {
    expect(() => editor.updateCourseSalesCopy(courseId, "   ")).toThrow(
      "Sales copy cannot be empty"
    );
  });

  it("saves sales copy", () => {
    editor.updateCourseSalesCopy(courseId, "# Buy it");
    expect(editor.getCourseWithDetails(courseId)?.salesCopy).toBe("# Buy it");
  });
});

describe("modules", () => {
  it("appends a module after the last one when no position is given", () => {
    editor.createModule(courseId, "First", null);
    const second = editor.createModule(courseId, "Second", null);
    expect(second.position).toBe(2);
  });

  it("renames a module", () => {
    const mod = editor.createModule(courseId, "Old", null);
    editor.updateModuleTitle(mod.id, "New");
    expect(editor.getModuleById(mod.id)?.title).toBe("New");
  });

  it("deletes a module together with its lessons", () => {
    const mod = editor.createModule(courseId, "Doomed", null);
    const lesson = addLesson(mod.id, "Gone too");

    editor.deleteModule(mod.id);

    expect(editor.getModuleById(mod.id)).toBeUndefined();
    expect(editor.getLessonById(lesson.id)).toBeUndefined();
  });

  it("reorders the course's modules in the order given", () => {
    const a = editor.createModule(courseId, "A", null);
    const b = editor.createModule(courseId, "B", null);
    const c = editor.createModule(courseId, "C", null);

    const reordered = editor.reorderModules(courseId, [c.id, a.id, b.id]);

    expect(reordered.map((mod) => mod.title)).toEqual(["C", "A", "B"]);
  });
});

describe("lessons", () => {
  it("appends a lesson after the last one in its module", () => {
    const mod = editor.createModule(courseId, "Module", null);
    addLesson(mod.id, "One");
    expect(addLesson(mod.id, "Two").position).toBe(2);
  });

  it("renames and deletes a lesson", () => {
    const mod = editor.createModule(courseId, "Module", null);
    const lesson = addLesson(mod.id, "Old");

    editor.updateLessonTitle(lesson.id, "New");
    expect(editor.getLessonById(lesson.id)?.title).toBe("New");

    editor.deleteLesson(lesson.id);
    expect(editor.getLessonById(lesson.id)).toBeUndefined();
  });

  it("reorders lessons within a module", () => {
    const mod = editor.createModule(courseId, "Module", null);
    const one = addLesson(mod.id, "One");
    const two = addLesson(mod.id, "Two");

    const reordered = editor.reorderLessons(mod.id, [two.id, one.id]);

    expect(reordered.map((lesson) => lesson.title)).toEqual(["Two", "One"]);
  });

  it("moves a lesson to another module, closing and opening the gaps", () => {
    const source = editor.createModule(courseId, "Source", null);
    const target = editor.createModule(courseId, "Target", null);
    addLesson(source.id, "S1");
    const moving = addLesson(source.id, "S2");
    addLesson(source.id, "S3");
    addLesson(target.id, "T1");
    addLesson(target.id, "T2");

    const moved = editor.moveLessonToModule(moving.id, target.id, 2);

    expect(moved).toMatchObject({ moduleId: target.id, position: 2 });
    expect(lessonTitles(source.id)).toEqual(["S1", "S3"]);
    expect(lessonTitles(target.id)).toEqual(["T1", "S2", "T2"]);
  });

  it("moves nothing when the lesson does not exist", () => {
    const target = editor.createModule(courseId, "Target", null);
    expect(editor.moveLessonToModule(9999, target.id, 1)).toBeNull();
  });
});

describe("student roster", () => {
  // The editor has no functions for enrolling, progress or quiz attempts, so
  // these rows go in directly.
  function enroll(userId: number) {
    db.insert(schema.enrollments).values({ userId, courseId }).run();
  }

  function complete(userId: number, lessonId: number) {
    db.insert(schema.lessonProgress)
      .values({ userId, lessonId, status: LessonProgressStatus.Completed })
      .run();
  }

  function addQuiz(lessonId: number, title: string) {
    return db
      .insert(schema.quizzes)
      .values({ lessonId, title, passingScore: 0.7 })
      .returning()
      .get();
  }

  function attempt(userId: number, quizId: number, score: number) {
    db.insert(schema.quizAttempts)
      .values({ userId, quizId, score, passed: score >= 0.7 })
      .run();
  }

  function roster() {
    const course = editor.getCourseWithDetails(courseId);
    return editor.getStudentRoster(
      courseId,
      course?.modules.flatMap((mod) => mod.lessons) ?? []
    );
  }

  it("is empty when nobody is enrolled", () => {
    expect(roster()).toEqual({ students: [], quizCount: 0 });
    expect(editor.getEnrollmentCountForCourse(courseId)).toBe(0);
  });

  it("lists each student's progress and best score on each quiz", () => {
    const mod = editor.createModule(courseId, "Module", null);
    const first = addLesson(mod.id, "First");
    const second = addLesson(mod.id, "Second");
    const quiz = addQuiz(second.id, "Check");
    enroll(base.user.id);
    complete(base.user.id, first.id);
    attempt(base.user.id, quiz.id, 0.5);
    attempt(base.user.id, quiz.id, 0.9);

    const { students, quizCount } = roster();

    expect(editor.getEnrollmentCountForCourse(courseId)).toBe(1);
    expect(quizCount).toBe(1);
    expect(students).toHaveLength(1);
    expect(students[0]).toMatchObject({
      userId: base.user.id,
      name: "Test User",
      email: "test@example.com",
      completedAt: null,
      progress: 50,
      quizScores: [
        {
          quizId: quiz.id,
          quizTitle: "Check",
          lessonTitle: "Second",
          bestScore: 0.9,
          passed: true,
        },
      ],
    });
  });

  it("shows no score for a quiz the student has not attempted", () => {
    const mod = editor.createModule(courseId, "Module", null);
    const lesson = addLesson(mod.id, "Only");
    addQuiz(lesson.id, "Check");
    enroll(base.user.id);

    const [student] = roster().students;

    expect(student.progress).toBe(0);
    expect(student.quizScores[0]).toMatchObject({
      bestScore: null,
      passed: null,
    });
  });
});
