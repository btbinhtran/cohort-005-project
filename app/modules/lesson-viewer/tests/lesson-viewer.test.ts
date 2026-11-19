import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { markdown } from "~/lib/text";
import { createCoursePermissions } from "~/modules/permissions/course-permissions.server";
import type { Person } from "~/modules/permissions/person.server";
import { createLessonViewer } from "../index.server";

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let viewer: ReturnType<typeof createLessonViewer>;
let firstLesson: typeof schema.lessons.$inferSelect;
let secondLesson: typeof schema.lessons.$inferSelect;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  viewer = createLessonViewer(db);

  const mod = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  firstLesson = addLesson(mod.id, "First steps", 1);
  secondLesson = addLesson(mod.id, "Second steps", 2);
});

// ─── Fixtures ───

function addLesson(moduleId: number, title: string, position: number) {
  return db
    .insert(schema.lessons)
    .values({
      moduleId,
      title,
      position,
      content: markdown(`# ${title}`),
    })
    .returning()
    .get();
}

function student(): Person {
  return { id: base.user.id, role: "student", country: null };
}

function enrollStudent() {
  db.insert(schema.enrollments)
    .values({ userId: base.user.id, courseId: base.course.id })
    .run();
}

function decisionsFor(person: Person | null, lessonId: number) {
  const decisions = createCoursePermissions(db).decide(person, {
    slug: base.course.slug,
    lessonId: String(lessonId),
  });
  if (!decisions.found) throw new Error("course not found");
  return decisions;
}

function load(person: Person | null, lessonId = firstLesson.id) {
  return viewer.loadLessonPage(decisionsFor(person, lessonId), lessonId);
}

function addTrueFalseQuiz(lessonId: number) {
  const quiz = db
    .insert(schema.quizzes)
    .values({ lessonId, title: "Check yourself", passingScore: 0.7 })
    .returning()
    .get();
  const question = db
    .insert(schema.quizQuestions)
    .values({
      quizId: quiz.id,
      questionText: "Is the sky blue?",
      questionType: schema.QuestionType.TrueFalse,
      position: 1,
    })
    .returning()
    .get();
  const [right, wrong] = db
    .insert(schema.quizOptions)
    .values([
      { questionId: question.id, optionText: "True", isCorrect: true },
      { questionId: question.id, optionText: "False", isCorrect: false },
    ])
    .returning()
    .all();
  return { quiz, question, right, wrong };
}

// ─── Tests ───

describe("loadLessonPage", () => {
  it("shows a signed-out visitor the locked view with the reason", async () => {
    const page = await load(null);

    expect(page?.view).toBe("locked");
    if (page?.view !== "locked") return;
    expect(page.lockedReason).toEqual({ kind: "signed-out" });
    expect(page.lesson).toEqual({ id: firstLesson.id, title: "First steps" });
    expect(page.curriculum[0].lessons.map((l) => l.title)).toEqual([
      "First steps",
      "Second steps",
    ]);
  });

  it("shows an enrolled student the full lesson and marks it in progress", async () => {
    enrollStudent();

    const page = await load(student());

    expect(page?.view).toBe("full");
    if (page?.view !== "full") return;
    expect(page.lessonStatus).toBe(schema.LessonProgressStatus.InProgress);
    expect(page.contentHtml).toContain("First steps");
    expect(page.prevLesson).toBeNull();
    expect(page.nextLesson?.id).toBe(secondLesson.id);
    expect(page.instructorName).toBe(base.instructor.name);
  });

  it("returns null for a lesson that does not exist", async () => {
    enrollStudent();
    const decisions = decisionsFor(student(), firstLesson.id);

    expect(await viewer.loadLessonPage(decisions, 9999)).toBeNull();
  });

  it("keeps the right answers out of the quiz it sends", async () => {
    enrollStudent();
    addTrueFalseQuiz(firstLesson.id);

    const page = await load(student());

    if (page?.view !== "full") throw new Error("expected the full view");
    const options = page.quiz?.questions[0].options ?? [];
    expect(options).toHaveLength(2);
    for (const option of options) {
      expect(option).not.toHaveProperty("isCorrect");
    }
  });
});

describe("markLessonComplete", () => {
  it("shows the lesson as completed on the next load", async () => {
    enrollStudent();

    viewer.markLessonComplete(base.user.id, firstLesson.id);
    const page = await load(student());

    if (page?.view !== "full") throw new Error("expected the full view");
    expect(page.lessonStatus).toBe(schema.LessonProgressStatus.Completed);
    expect(page.lessonProgressMap[firstLesson.id]).toBe(
      schema.LessonProgressStatus.Completed
    );
  });
});

describe("submitQuiz", () => {
  it("scores a right answer as a pass and records the best attempt", async () => {
    enrollStudent();
    const { quiz, question, right } = addTrueFalseQuiz(firstLesson.id);

    const result = viewer.submitQuiz({
      userId: base.user.id,
      quizId: quiz.id,
      selectedAnswers: { [question.id]: right.id },
    });

    expect(result).toMatchObject({ score: 1, passed: true, grade: "A" });
    const page = await load(student());
    if (page?.view !== "full") throw new Error("expected the full view");
    expect(page.bestAttempt).toEqual({ score: 1, passed: true });
  });

  it("scores a wrong answer as a fail and reports the right option", () => {
    const { quiz, question, right, wrong } = addTrueFalseQuiz(firstLesson.id);

    const result = viewer.submitQuiz({
      userId: base.user.id,
      quizId: quiz.id,
      selectedAnswers: { [question.id]: wrong.id },
    });

    expect(result).toMatchObject({ score: 0, passed: false, grade: "F" });
    expect(result?.questionResults[0]).toEqual({
      questionId: question.id,
      correct: false,
      selectedOptionId: wrong.id,
      correctOptionId: right.id,
    });
  });

  it("gives null for a quiz that does not exist", () => {
    expect(
      viewer.submitQuiz({
        userId: base.user.id,
        quizId: 9999,
        selectedAnswers: {},
      })
    ).toBeNull();
  });
});

describe("getQuiz and getComment", () => {
  it("finds a quiz by id, with the lesson it belongs to", () => {
    const { quiz } = addTrueFalseQuiz(secondLesson.id);

    expect(viewer.getQuiz(quiz.id)?.lessonId).toBe(secondLesson.id);
    expect(viewer.getQuiz(9999)).toBeUndefined();
  });

  it("finds a comment by id, with the lesson it belongs to", () => {
    const comment = db
      .insert(schema.comments)
      .values({
        userId: base.user.id,
        lessonId: firstLesson.id,
        body: markdown("Question?"),
      })
      .returning()
      .get();

    expect(viewer.getComment(comment.id)?.lessonId).toBe(firstLesson.id);
    expect(viewer.getComment(9999)).toBeUndefined();
  });
});
