import { countRows, db } from "./db";
import * as schema from "../../app/db/schema";
import { QuestionType } from "../../app/db/schema";

export function seedQuizzes({
  course1LessonIds,
  course2LessonIds,
}: {
  course1LessonIds: number[];
  course2LessonIds: number[];
}) {
  // ─── Quizzes ───
  // Add quizzes to some lessons in both courses

  // Quiz 1: TypeScript Basics Quiz (attached to "Your First TypeScript Program", lesson 3 of course 1)
  const [quiz1] = db
    .insert(schema.quizzes)
    .values({
      lessonId: course1LessonIds[2], // "Your First TypeScript Program"
      title: "TypeScript Basics Quiz",
      passingScore: 0.7,
    })
    .returning()
    .all();

  const quiz1Questions = [
    {
      text: "What does TypeScript compile to?",
      type: QuestionType.MultipleChoice,
      options: [
        { text: "JavaScript", correct: true },
        { text: "WebAssembly", correct: false },
        { text: "Java bytecode", correct: false },
        { text: "Machine code", correct: false },
      ],
    },
    {
      text: "TypeScript is a superset of JavaScript.",
      type: QuestionType.TrueFalse,
      options: [
        { text: "True", correct: true },
        { text: "False", correct: false },
      ],
    },
    {
      text: "Which file configures the TypeScript compiler?",
      type: QuestionType.MultipleChoice,
      options: [
        { text: "tsconfig.json", correct: true },
        { text: "package.json", correct: false },
        { text: "typescript.config.js", correct: false },
        { text: ".tsrc", correct: false },
      ],
    },
  ];

  const quiz1OptionIds: {
    questionId: number;
    optionId: number;
    correct: boolean;
  }[] = [];

  for (let qi = 0; qi < quiz1Questions.length; qi++) {
    const q = quiz1Questions[qi];
    const [question] = db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz1.id,
        questionText: q.text,
        questionType: q.type,
        position: qi + 1,
      })
      .returning()
      .all();

    for (const opt of q.options) {
      const [option] = db
        .insert(schema.quizOptions)
        .values({
          questionId: question.id,
          optionText: opt.text,
          isCorrect: opt.correct,
        })
        .returning()
        .all();
      quiz1OptionIds.push({
        questionId: question.id,
        optionId: option.id,
        correct: opt.correct,
      });
    }
  }

  // Quiz 2: Generics Quiz (attached to "Generics Basics", lesson index 5 in course 1)
  const [quiz2] = db
    .insert(schema.quizzes)
    .values({
      lessonId: course1LessonIds[7], // "Generics Basics" (module 3, lesson 2)
      title: "Generics Knowledge Check",
      passingScore: 0.6,
    })
    .returning()
    .all();

  const quiz2Questions = [
    {
      text: "What is the primary benefit of generics?",
      type: QuestionType.MultipleChoice,
      options: [
        { text: "Code reusability with type safety", correct: true },
        { text: "Faster execution speed", correct: false },
        { text: "Smaller bundle size", correct: false },
        { text: "Better error messages", correct: false },
      ],
    },
    {
      text: "Generic type parameters can be constrained using the 'extends' keyword.",
      type: QuestionType.TrueFalse,
      options: [
        { text: "True", correct: true },
        { text: "False", correct: false },
      ],
    },
  ];

  const quiz2OptionIds: {
    questionId: number;
    optionId: number;
    correct: boolean;
  }[] = [];

  for (let qi = 0; qi < quiz2Questions.length; qi++) {
    const q = quiz2Questions[qi];
    const [question] = db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz2.id,
        questionText: q.text,
        questionType: q.type,
        position: qi + 1,
      })
      .returning()
      .all();

    for (const opt of q.options) {
      const [option] = db
        .insert(schema.quizOptions)
        .values({
          questionId: question.id,
          optionText: opt.text,
          isCorrect: opt.correct,
        })
        .returning()
        .all();
      quiz2OptionIds.push({
        questionId: question.id,
        optionId: option.id,
        correct: opt.correct,
      });
    }
  }

  // Quiz 3: REST API Basics (attached to "HTTP Methods and Status Codes", lesson index 2 in course 2)
  const [quiz3] = db
    .insert(schema.quizzes)
    .values({
      lessonId: course2LessonIds[2], // "HTTP Methods and Status Codes"
      title: "HTTP Methods Quiz",
      passingScore: 0.7,
    })
    .returning()
    .all();

  const quiz3Questions = [
    {
      text: "Which HTTP method is used to create a new resource?",
      type: QuestionType.MultipleChoice,
      options: [
        { text: "POST", correct: true },
        { text: "GET", correct: false },
        { text: "PUT", correct: false },
        { text: "PATCH", correct: false },
      ],
    },
    {
      text: "A 404 status code means the server encountered an internal error.",
      type: QuestionType.TrueFalse,
      options: [
        { text: "True", correct: false },
        { text: "False", correct: true },
      ],
    },
    {
      text: "Which status code indicates successful resource creation?",
      type: QuestionType.MultipleChoice,
      options: [
        { text: "201 Created", correct: true },
        { text: "200 OK", correct: false },
        { text: "204 No Content", correct: false },
        { text: "202 Accepted", correct: false },
      ],
    },
  ];

  const quiz3OptionIds: {
    questionId: number;
    optionId: number;
    correct: boolean;
  }[] = [];

  for (let qi = 0; qi < quiz3Questions.length; qi++) {
    const q = quiz3Questions[qi];
    const [question] = db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz3.id,
        questionText: q.text,
        questionType: q.type,
        position: qi + 1,
      })
      .returning()
      .all();

    for (const opt of q.options) {
      const [option] = db
        .insert(schema.quizOptions)
        .values({
          questionId: question.id,
          optionText: opt.text,
          isCorrect: opt.correct,
        })
        .returning()
        .all();
      quiz3OptionIds.push({
        questionId: question.id,
        optionId: option.id,
        correct: opt.correct,
      });
    }
  }

  console.log(
    `Created ${countRows(schema.quizzes)} quizzes with ${countRows(schema.quizQuestions)} questions and ${countRows(schema.quizOptions)} options.`
  );

  return {
    quiz1,
    quiz1OptionIds,
    quiz2,
    quiz2OptionIds,
    quiz3,
    quiz3OptionIds,
  };
}
