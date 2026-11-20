import { and, desc, eq, or, sql } from "drizzle-orm";
import {
  lessonProgress,
  lessons,
  modules,
  videoWatchEvents,
  LessonProgressStatus,
} from "~/db/schema";
import type { Db } from "./course-outline";

export function getLessonProgress(
  database: Db,
  userId: number,
  lessonId: number
) {
  return database
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.lessonId, lessonId)
      )
    )
    .get();
}

export function getLessonProgressForCourse(
  database: Db,
  userId: number,
  courseId: number
) {
  const courseModules = database
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .all();

  if (courseModules.length === 0) return [];

  const courseLessons = database
    .select({ id: lessons.id })
    .from(lessons)
    .where(or(...courseModules.map((m) => eq(lessons.moduleId, m.id))))
    .all();

  if (courseLessons.length === 0) return [];

  return database
    .select()
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        or(...courseLessons.map((l) => eq(lessonProgress.lessonId, l.id)))
      )
    )
    .all();
}

export function markLessonComplete(
  database: Db,
  userId: number,
  lessonId: number
) {
  const existing = getLessonProgress(database, userId, lessonId);

  if (existing) {
    return database
      .update(lessonProgress)
      .set({
        status: LessonProgressStatus.Completed,
        completedAt: new Date().toISOString(),
      })
      .where(eq(lessonProgress.id, existing.id))
      .returning()
      .get();
  }

  return database
    .insert(lessonProgress)
    .values({
      userId,
      lessonId,
      status: LessonProgressStatus.Completed,
      completedAt: new Date().toISOString(),
    })
    .returning()
    .get();
}

export function markLessonInProgress(
  database: Db,
  userId: number,
  lessonId: number
) {
  const existing = getLessonProgress(database, userId, lessonId);

  if (existing) {
    if (existing.status === LessonProgressStatus.Completed) {
      return existing;
    }
    return database
      .update(lessonProgress)
      .set({ status: LessonProgressStatus.InProgress })
      .where(eq(lessonProgress.id, existing.id))
      .returning()
      .get();
  }

  return database
    .insert(lessonProgress)
    .values({
      userId,
      lessonId,
      status: LessonProgressStatus.InProgress,
    })
    .returning()
    .get();
}

export function getLastWatchPosition(
  database: Db,
  userId: number,
  lessonId: number
) {
  const lastEvent = database
    .select()
    .from(videoWatchEvents)
    .where(
      and(
        eq(videoWatchEvents.userId, userId),
        eq(videoWatchEvents.lessonId, lessonId)
      )
    )
    .orderBy(desc(videoWatchEvents.createdAt))
    .limit(1)
    .get();

  return lastEvent?.positionSeconds ?? 0;
}

export function calculateWatchProgress(
  database: Db,
  {
    userId,
    lessonId,
    videoDurationSeconds,
  }: { userId: number; lessonId: number; videoDurationSeconds: number }
) {
  if (videoDurationSeconds <= 0) return 0;

  const result = database
    .select({ maxPos: sql<number>`max(${videoWatchEvents.positionSeconds})` })
    .from(videoWatchEvents)
    .where(
      and(
        eq(videoWatchEvents.userId, userId),
        eq(videoWatchEvents.lessonId, lessonId)
      )
    )
    .get();

  const maxPosition = result?.maxPos ?? 0;

  return Math.min(Math.round((maxPosition / videoDurationSeconds) * 100), 100);
}
