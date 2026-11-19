import { describe, it, expect, beforeEach } from "vitest";
import { LessonProgressStatus } from "~/db/schema";
import {
  instructor,
  course,
  otherCourse,
  addUser,
  addCourse,
  addModule,
  addLesson,
  buy,
  enroll,
  progress,
  addQuiz,
  attempt,
  asInstructor,
  setUpFixtures,
} from "./fixtures";

beforeEach(setUpFixtures);

describe("course progress", () => {
  let lessonIds: number[];

  beforeEach(() => {
    const first = addModule(course.id, "Basics", 1);
    const second = addModule(course.id, "Advanced", 2);
    lessonIds = [
      addLesson(first.id, "Lesson 1", 1).id,
      addLesson(first.id, "Lesson 2", 2).id,
      addLesson(second.id, "Lesson 3", 1).id,
    ];
  });

  function courseTab(params: Record<string, string> = {}) {
    return asInstructor({
      tab: "course",
      course: String(course.id),
      ...params,
    });
  }

  it("averages completion across every enrollee, including those who never started", () => {
    const finisher = addUser("Finisher");
    const starter = addUser("Starter");
    const vanished = addUser("Vanished");
    for (const student of [finisher, starter, vanished]) {
      enroll(student.id, course.id);
    }
    for (const lessonId of lessonIds) {
      progress(finisher.id, lessonId, LessonProgressStatus.Completed);
    }
    progress(starter.id, lessonIds[0], LessonProgressStatus.Completed);
    progress(starter.id, lessonIds[1], LessonProgressStatus.InProgress);

    // (100 + 33⅓ + 0) / 3
    expect(courseTab().progress).toEqual({
      enrolledCount: 3,
      totalLessons: 3,
      averageProgressPercent: 44,
      finishedCount: 1,
    });
  });

  it("ignores progress on other courses' lessons", () => {
    const student = addUser("Student");
    enroll(student.id, course.id);
    const elsewhere = addModule(otherCourse.id, "Elsewhere", 1);
    progress(
      student.id,
      addLesson(elsewhere.id, "Their lesson", 1).id,
      LessonProgressStatus.Completed
    );

    expect(courseTab().progress?.averageProgressPercent).toBe(0);
  });

  it("spans all time whatever the range", () => {
    enroll(addUser("Long Ago").id, course.id, 300);

    expect(courseTab({ range: "7d" }).progress?.enrolledCount).toBe(1);
  });

  it("has no average with nobody enrolled", () => {
    expect(courseTab().progress).toEqual({
      enrolledCount: 0,
      totalLessons: 3,
      averageProgressPercent: null,
      finishedCount: 0,
    });
  });

  it("has no average for a course without lessons", () => {
    const empty = addCourse(instructor.id, "Empty Course");
    enroll(addUser("Student").id, empty.id);

    expect(asInstructor({ course: String(empty.id) }).progress).toEqual({
      enrolledCount: 1,
      totalLessons: 0,
      averageProgressPercent: null,
      finishedCount: 0,
    });
  });
});

describe("drop-off funnel", () => {
  let lessonIds: number[];
  let firstModuleId: number;
  let secondModuleId: number;

  beforeEach(() => {
    // Inserted out of order: the funnel follows position, not id.
    secondModuleId = addModule(course.id, "Advanced", 2).id;
    firstModuleId = addModule(course.id, "Basics", 1).id;
    const lesson3 = addLesson(secondModuleId, "Lesson 3", 1).id;
    const lesson2 = addLesson(firstModuleId, "Lesson 2", 2).id;
    const lesson1 = addLesson(firstModuleId, "Lesson 1", 1).id;
    lessonIds = [lesson1, lesson2, lesson3];
  });

  function funnel() {
    return asInstructor({ course: String(course.id) }).funnel;
  }

  it("counts each student as reaching every lesson up to their furthest", () => {
    const [lesson1, lesson2, lesson3] = lessonIds;
    // Skipped straight to the end: still counted as passing through 1 and 2.
    const skipper = addUser("Skipper");
    const steady = addUser("Steady");
    const quitter = addUser("Quitter");
    const neverStarted = addUser("Never Started");
    const opened = addUser("Opened Only");
    for (const student of [skipper, steady, quitter, neverStarted, opened]) {
      enroll(student.id, course.id);
    }
    progress(skipper.id, lesson3, LessonProgressStatus.InProgress);
    progress(steady.id, lesson1, LessonProgressStatus.Completed);
    progress(steady.id, lesson2, LessonProgressStatus.Completed);
    progress(quitter.id, lesson1, LessonProgressStatus.InProgress);
    progress(opened.id, lesson1, LessonProgressStatus.NotStarted);

    expect(funnel()).toEqual({
      enrolledCount: 5,
      modules: [
        {
          moduleId: firstModuleId,
          title: "Basics",
          reachedCount: 3,
          dropWithin: 1,
          lessons: [
            {
              lessonId: lesson1,
              title: "Lesson 1",
              reachedCount: 3,
              dropFromPrevious: 2,
            },
            {
              lessonId: lesson2,
              title: "Lesson 2",
              reachedCount: 2,
              dropFromPrevious: 1,
            },
          ],
        },
        {
          moduleId: secondModuleId,
          title: "Advanced",
          reachedCount: 1,
          dropWithin: 0,
          lessons: [
            {
              lessonId: lesson3,
              title: "Lesson 3",
              reachedCount: 1,
              dropFromPrevious: 1,
            },
          ],
        },
      ],
    });
  });

  it("ignores progress from someone not enrolled", () => {
    progress(
      addUser("Tourist").id,
      lessonIds[2],
      LessonProgressStatus.Completed
    );

    const result = funnel();

    expect(result?.enrolledCount).toBe(0);
    expect(result?.modules.map((module) => module.reachedCount)).toEqual([
      0, 0,
    ]);
  });

  it("ignores progress from someone enrolled only on a different course", () => {
    const tourist = addUser("Tourist");
    enroll(tourist.id, otherCourse.id);
    progress(tourist.id, lessonIds[2], LessonProgressStatus.Completed);

    expect(funnel()?.modules.map((module) => module.reachedCount)).toEqual([
      0, 0,
    ]);
  });

  it("has no modules for a course without lessons", () => {
    const empty = addCourse(instructor.id, "Empty Course");
    enroll(addUser("Student").id, empty.id);

    expect(asInstructor({ course: String(empty.id) }).funnel).toEqual({
      enrolledCount: 1,
      modules: [],
    });
  });
});

describe("quiz pass rates", () => {
  let lesson1: number;
  let lesson3: number;

  beforeEach(() => {
    const first = addModule(course.id, "Basics", 1);
    const second = addModule(course.id, "Advanced", 2);
    lesson1 = addLesson(first.id, "Lesson 1", 1).id;
    lesson3 = addLesson(second.id, "Lesson 3", 1).id;
  });

  function quizzes(params: Record<string, string> = {}) {
    return asInstructor({ course: String(course.id), ...params }).quizzes;
  }

  it("judges each student by their best attempt", () => {
    const quiz = addQuiz(lesson1, "Basics Quiz", 0.7);
    const improver = addUser("Improver");
    const struggler = addUser("Struggler");
    attempt(improver.id, quiz.id, 0.5, false);
    attempt(improver.id, quiz.id, 0.9, true);
    attempt(struggler.id, quiz.id, 0.6, false);

    expect(quizzes()).toEqual([
      {
        quizId: quiz.id,
        title: "Basics Quiz",
        moduleTitle: "Basics",
        lessonTitle: "Lesson 1",
        passingScorePercent: 70,
        studentCount: 2,
        passedCount: 1,
        passRatePercent: 50,
        averageBestScorePercent: 75,
      },
    ]);
  });

  it("trusts the verdict recorded on the best attempt", () => {
    // Failed under an older, stricter pass mark; not re-judged now.
    const quiz = addQuiz(lesson1, "Basics Quiz", 0.7);
    attempt(addUser("Student").id, quiz.id, 0.72, false);

    expect(quizzes()?.[0]).toMatchObject({
      passedCount: 0,
      passRatePercent: 0,
    });
  });

  it("lists quizzes in curriculum order, including unattempted ones", () => {
    const later = addQuiz(lesson3, "Advanced Quiz", 0.8);
    const earlier = addQuiz(lesson1, "Basics Quiz", 0.7);

    expect(quizzes()?.map((quiz) => quiz.quizId)).toEqual([
      earlier.id,
      later.id,
    ]);
    expect(quizzes()?.[1]).toMatchObject({
      studentCount: 0,
      passedCount: 0,
      passRatePercent: null,
      averageBestScorePercent: null,
    });
  });

  it("only counts attempts inside the range", () => {
    const quiz = addQuiz(lesson3, "Advanced Quiz", 0.8);
    attempt(addUser("Student").id, quiz.id, 0.85, true, 40);

    expect(quizzes({ range: "30d" })?.[0].studentCount).toBe(0);
    expect(quizzes({ range: "all" })?.[0]).toMatchObject({
      studentCount: 1,
      passRatePercent: 100,
      averageBestScorePercent: 85,
    });
  });

  it("is empty for a course without quizzes", () => {
    expect(quizzes()).toEqual([]);
  });
});

describe("revenue by country", () => {
  function countries(params: Record<string, string> = {}) {
    return asInstructor({ course: String(course.id), ...params }).countries;
  }

  it("breaks sales down by country, biggest first, with parity discounts", () => {
    const student = addUser("Student");
    buy(student.id, course.id, 10000, { country: "US" });
    buy(student.id, course.id, 10000, { country: "US" });
    buy(student.id, course.id, 8000, { country: null });
    buy(student.id, course.id, 5000, { country: "IN" });
    buy(student.id, course.id, 3000, { country: "NG" });

    expect(countries()).toEqual({
      grossCents: 36000,
      netCents: 28800,
      purchaseCount: 5,
      discountedGrossCents: 8000,
      discountedNetCents: 6400,
      discountedSharePercent: 22,
      rows: [
        {
          country: "US",
          purchaseCount: 2,
          grossCents: 20000,
          netCents: 16000,
          sharePercent: 56,
          averagePaidCents: 10000,
          discountPercent: 0,
        },
        {
          country: null,
          purchaseCount: 1,
          grossCents: 8000,
          netCents: 6400,
          sharePercent: 22,
          averagePaidCents: 8000,
          discountPercent: null,
        },
        {
          country: "IN",
          purchaseCount: 1,
          grossCents: 5000,
          netCents: 4000,
          sharePercent: 14,
          averagePaidCents: 5000,
          discountPercent: 50,
        },
        {
          country: "NG",
          purchaseCount: 1,
          grossCents: 3000,
          netCents: 2400,
          sharePercent: 8,
          averagePaidCents: 3000,
          discountPercent: 70,
        },
      ],
    });
  });

  it("only counts this course's sales inside the range", () => {
    const student = addUser("Student");
    buy(student.id, course.id, 1000, { daysBack: 2 });
    buy(student.id, course.id, 2000, { daysBack: 40 });
    buy(student.id, otherCourse.id, 4000, { daysBack: 2 });

    expect(countries({ range: "30d" })?.grossCents).toBe(1000);
    expect(countries({ range: "all" })?.grossCents).toBe(3000);
  });

  it("is all zeroes with no sales", () => {
    expect(countries()).toEqual({
      grossCents: 0,
      netCents: 0,
      purchaseCount: 0,
      discountedGrossCents: 0,
      discountedNetCents: 0,
      discountedSharePercent: 0,
      rows: [],
    });
  });
});
