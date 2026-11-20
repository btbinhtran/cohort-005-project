import { and, count, countDistinct, eq, inArray } from "drizzle-orm";
import {
  LessonProgressStatus,
  enrollments,
  lessonProgress,
  lessons,
  modules,
} from "~/db/schema";
import type { Db } from "./scope";

export type CourseProgressSummary = {
  enrolledCount: number;
  totalLessons: number;
  averageProgressPercent: number | null;
  finishedCount: number;
};

export type FunnelLesson = {
  lessonId: number;
  title: string;
  reachedCount: number;
  dropFromPrevious: number;
};

export type FunnelModule = {
  moduleId: number;
  title: string;
  reachedCount: number;
  dropWithin: number;
  lessons: FunnelLesson[];
};

export type CourseFunnel = {
  enrolledCount: number;
  modules: FunnelModule[];
};

/** Every lesson of a course, as a subquery for the progress joins. */
function courseLessonIds(db: Db, courseId: number) {
  return db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId));
}

export function getCourseProgressSummary(
  db: Db,
  courseId: number
): CourseProgressSummary {
  const totals = db
    .select({ totalLessons: count(lessons.id) })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .get();

  const totalLessons = totals?.totalLessons ?? 0;

  // One grouped row per enrollee, including the ones who never started: a
  // student who bought and vanished is the finding, so a left join keeps them.
  const perStudent = db
    .select({
      userId: enrollments.userId,
      completed: countDistinct(lessonProgress.lessonId),
    })
    .from(enrollments)
    .leftJoin(
      lessonProgress,
      and(
        eq(lessonProgress.userId, enrollments.userId),
        eq(lessonProgress.status, LessonProgressStatus.Completed),
        inArray(lessonProgress.lessonId, courseLessonIds(db, courseId))
      )
    )
    .where(eq(enrollments.courseId, courseId))
    .groupBy(enrollments.userId)
    .all();

  if (perStudent.length === 0 || totalLessons === 0) {
    return {
      enrolledCount: perStudent.length,
      totalLessons,
      averageProgressPercent: null,
      finishedCount: 0,
    };
  }

  const totalPercent = perStudent.reduce(
    (running, student) => running + (student.completed / totalLessons) * 100,
    0
  );

  return {
    enrolledCount: perStudent.length,
    totalLessons,
    averageProgressPercent: Math.round(totalPercent / perStudent.length),
    finishedCount: perStudent.filter(
      (student) => student.completed >= totalLessons
    ).length,
  };
}

/** A lesson a student has opened counts as reached; one they haven't doesn't. */
const REACHED_STATUSES = [
  LessonProgressStatus.InProgress,
  LessonProgressStatus.Completed,
];

export function getCourseDropOff(db: Db, courseId: number): CourseFunnel {
  const enrolled = db
    .select({ enrolledCount: countDistinct(enrollments.userId) })
    .from(enrollments)
    .where(eq(enrollments.courseId, courseId))
    .get();

  const enrolledCount = enrolled?.enrolledCount ?? 0;

  const curriculum = db
    .select({
      moduleId: modules.id,
      moduleTitle: modules.title,
      lessonId: lessons.id,
      lessonTitle: lessons.title,
    })
    .from(modules)
    .innerJoin(lessons, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .orderBy(modules.position, lessons.position)
    .all();

  if (curriculum.length === 0) return { enrolledCount, modules: [] };

  const positionOf = new Map(
    curriculum.map((row, position) => [row.lessonId, position])
  );

  // Enrolment is joined rather than filtered afterwards, so somebody working
  // through a course they never enrolled in cannot inflate a bar past the
  // denominator underneath it.
  const touched = db
    .selectDistinct({
      userId: lessonProgress.userId,
      lessonId: lessonProgress.lessonId,
    })
    .from(lessonProgress)
    .innerJoin(
      enrollments,
      and(
        eq(enrollments.userId, lessonProgress.userId),
        eq(enrollments.courseId, courseId)
      )
    )
    .where(
      and(
        inArray(lessonProgress.lessonId, courseLessonIds(db, courseId)),
        inArray(lessonProgress.status, REACHED_STATUSES)
      )
    )
    .all();

  const furthest = new Map<number, number>();
  for (const row of touched) {
    const position = positionOf.get(row.lessonId);
    if (position === undefined) continue;
    furthest.set(
      row.userId,
      Math.max(furthest.get(row.userId) ?? -1, position)
    );
  }

  // Counted backwards from the end: everyone who stopped at a later lesson
  // passed through this one, which is the whole definition of the bar.
  const stoppedAt = curriculum.map(() => 0);
  for (const position of furthest.values()) stoppedAt[position] += 1;

  const reachedAt: number[] = [];
  let running = 0;
  for (let position = curriculum.length - 1; position >= 0; position--) {
    running += stoppedAt[position];
    reachedAt[position] = running;
  }

  const grouped: FunnelModule[] = [];
  let previousReached = enrolledCount;

  curriculum.forEach((row, position) => {
    const reachedCount = reachedAt[position];
    const lesson: FunnelLesson = {
      lessonId: row.lessonId,
      title: row.lessonTitle,
      reachedCount,
      dropFromPrevious: previousReached - reachedCount,
    };
    previousReached = reachedCount;

    const current = grouped.at(-1);
    if (current?.moduleId === row.moduleId) {
      current.lessons.push(lesson);
      current.dropWithin = current.reachedCount - reachedCount;
    } else {
      grouped.push({
        moduleId: row.moduleId,
        title: row.moduleTitle,
        reachedCount,
        dropWithin: 0,
        lessons: [lesson],
      });
    }
  });

  return { enrolledCount, modules: grouped };
}
