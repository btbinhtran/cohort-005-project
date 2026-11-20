import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { QuestionType } from "~/db/schema";
import { createQuizBuilder, wizardDataSchema } from "../index.server";

let db: TestDb;
let builder: ReturnType<typeof createQuizBuilder>;
let base: ReturnType<typeof seedBaseData>;
let moduleId: number;
let lessonId: number;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  builder = createQuizBuilder(db);
  // The quiz builder does not create modules or lessons, so these rows go in
  // directly.
  moduleId = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Module", position: 1 })
    .returning()
    .get().id;
  lessonId = db
    .insert(schema.lessons)
    .values({ moduleId, title: "Lesson", position: 1 })
    .returning()
    .get().id;
});

function buildQuiz() {
  const quiz = builder.createQuiz(lessonId, "Check", 0.7);
  const first = builder.createQuestion(
    quiz.id,
    "Is it?",
    QuestionType.TrueFalse,
    null
  );
  builder.createOption(first.id, "True", true);
  builder.createOption(first.id, "False", false);
  const second = builder.createQuestion(
    quiz.id,
    "Which?",
    QuestionType.MultipleChoice,
    null
  );
  builder.createOption(second.id, "A", false);
  builder.createOption(second.id, "B", true);
  return quiz;
}

describe("lookups", () => {
  it("finds the lesson and its module", () => {
    expect(builder.getLessonById(lessonId)?.title).toBe("Lesson");
    expect(builder.getModuleById(moduleId)?.title).toBe("Module");
  });

  it("finds no quiz for a lesson without one", () => {
    expect(builder.getQuizByLessonId(lessonId)).toBeUndefined();
    expect(builder.getQuizWithQuestions(9999)).toBeNull();
  });
});

describe("building a quiz", () => {
  it("returns the quiz with its questions in order and their options", () => {
    const quiz = buildQuiz();

    expect(builder.getQuizByLessonId(lessonId)?.id).toBe(quiz.id);
    const full = builder.getQuizWithQuestions(quiz.id);
    expect(full?.title).toBe("Check");
    expect(full?.passingScore).toBe(0.7);
    expect(full?.questions.map((q) => [q.questionText, q.position])).toEqual([
      ["Is it?", 1],
      ["Which?", 2],
    ]);
    expect(
      full?.questions[1].options.map((o) => [o.optionText, o.isCorrect])
    ).toEqual([
      ["A", false],
      ["B", true],
    ]);
  });

  it("puts a question at the position given", () => {
    const quiz = builder.createQuiz(lessonId, "Check", 0.5);
    const question = builder.createQuestion(
      quiz.id,
      "Q",
      QuestionType.TrueFalse,
      7
    );
    expect(question.position).toBe(7);
  });
});

describe("deleting a quiz", () => {
  // Only attempts without answers: deleteQuiz removes options before answers,
  // which a recorded answer's foreign key refuses.
  it("removes the quiz, its questions, options and attempts", () => {
    const quiz = buildQuiz();
    // Nothing in the quiz builder records attempts, so they go in directly.
    db.insert(schema.quizAttempts)
      .values({ userId: base.user.id, quizId: quiz.id, score: 1, passed: true })
      .run();

    builder.deleteQuiz(quiz.id);

    expect(builder.getQuizByLessonId(lessonId)).toBeUndefined();
    expect(
      db
        .select()
        .from(schema.quizQuestions)
        .where(eq(schema.quizQuestions.quizId, quiz.id))
        .all()
    ).toEqual([]);
    expect(db.select().from(schema.quizOptions).all()).toEqual([]);
    expect(db.select().from(schema.quizAttempts).all()).toEqual([]);
    expect(db.select().from(schema.quizAnswers).all()).toEqual([]);
  });
});

describe("wizardDataSchema", () => {
  const question = {
    id: "q1",
    text: "Is it?",
    type: QuestionType.TrueFalse,
    options: [{ id: "o1", text: "True", isCorrect: true }],
  };

  it("accepts a titled quiz with questions", () => {
    const parsed = wizardDataSchema.safeParse({
      title: "  Check  ",
      passingScore: 70,
      questions: [question],
    });
    expect(parsed.success && parsed.data.title).toBe("Check");
  });

  it("rejects a quiz without a title or questions", () => {
    expect(
      wizardDataSchema.safeParse({
        title: " ",
        passingScore: 70,
        questions: [question],
      }).success
    ).toBe(false);
    expect(
      wizardDataSchema.safeParse({
        title: "Check",
        passingScore: 70,
        questions: [],
      }).success
    ).toBe(false);
  });
});
