import { and, eq, gt, gte, sql } from "drizzle-orm";
import { lessons, modules } from "~/db/schema";
import { markdown } from "~/lib/text";
import type { Db } from "./db";

export function getModuleById(db: Db, id: number) {
  return db.select().from(modules).where(eq(modules.id, id)).get();
}

export function getModulesByCourse(db: Db, courseId: number) {
  return db
    .select()
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .orderBy(modules.position)
    .all();
}

export function createModule(
  db: Db,
  courseId: number,
  title: string,
  position: number | null
) {
  const pos =
    position ??
    (db
      .select({ max: sql<number>`coalesce(max(${modules.position}), 0)` })
      .from(modules)
      .where(eq(modules.courseId, courseId))
      .get()?.max ?? 0) + 1;

  return db
    .insert(modules)
    .values({ courseId, title, position: pos })
    .returning()
    .get();
}

export function updateModuleTitle(db: Db, id: number, title: string) {
  return db
    .update(modules)
    .set({ title })
    .where(eq(modules.id, id))
    .returning()
    .get();
}

export function deleteModule(db: Db, id: number) {
  // Delete all lessons in this module first
  db.delete(lessons).where(eq(lessons.moduleId, id)).run();
  return db.delete(modules).where(eq(modules.id, id)).returning().get();
}

export function reorderModules(db: Db, courseId: number, moduleIds: number[]) {
  for (let i = 0; i < moduleIds.length; i++) {
    db.update(modules)
      .set({ position: i + 1 })
      .where(and(eq(modules.id, moduleIds[i]), eq(modules.courseId, courseId)))
      .run();
  }
  return getModulesByCourse(db, courseId);
}

export function getLessonById(db: Db, id: number) {
  return db.select().from(lessons).where(eq(lessons.id, id)).get();
}

export function getLessonsByModule(db: Db, moduleId: number) {
  return db
    .select()
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))
    .orderBy(lessons.position)
    .all();
}

export function createLesson(
  db: Db,
  moduleId: number,
  title: string,
  content: string | null,
  videoUrl: string | null,
  position: number | null,
  durationMinutes: number | null
) {
  const pos =
    position ??
    (db
      .select({ max: sql<number>`coalesce(max(${lessons.position}), 0)` })
      .from(lessons)
      .where(eq(lessons.moduleId, moduleId))
      .get()?.max ?? 0) + 1;

  return db
    .insert(lessons)
    .values({
      moduleId,
      title,
      content: content === null ? null : markdown(content),
      videoUrl,
      position: pos,
      durationMinutes,
    })
    .returning()
    .get();
}

export function updateLessonTitle(db: Db, id: number, title: string) {
  return db
    .update(lessons)
    .set({ title })
    .where(eq(lessons.id, id))
    .returning()
    .get();
}

export function deleteLesson(db: Db, id: number) {
  return db.delete(lessons).where(eq(lessons.id, id)).returning().get();
}

export function reorderLessons(db: Db, moduleId: number, lessonIds: number[]) {
  for (let i = 0; i < lessonIds.length; i++) {
    db.update(lessons)
      .set({ position: i + 1 })
      .where(and(eq(lessons.id, lessonIds[i]), eq(lessons.moduleId, moduleId)))
      .run();
  }
  return getLessonsByModule(db, moduleId);
}

export function moveLessonToModule(
  db: Db,
  lessonId: number,
  targetModuleId: number,
  targetPosition: number
) {
  const lesson = getLessonById(db, lessonId);
  if (!lesson) return null;

  const sourceModuleId = lesson.moduleId;

  // 1. Close the gap in the source module
  db.update(lessons)
    .set({ position: sql`${lessons.position} - 1` })
    .where(
      and(
        eq(lessons.moduleId, sourceModuleId),
        gt(lessons.position, lesson.position)
      )
    )
    .run();

  // 2. Open a gap in the destination module
  db.update(lessons)
    .set({ position: sql`${lessons.position} + 1` })
    .where(
      and(
        eq(lessons.moduleId, targetModuleId),
        gte(lessons.position, targetPosition)
      )
    )
    .run();

  // 3. Move the lesson to the target module at the target position
  return db
    .update(lessons)
    .set({ moduleId: targetModuleId, position: targetPosition })
    .where(eq(lessons.id, lessonId))
    .returning()
    .get();
}
