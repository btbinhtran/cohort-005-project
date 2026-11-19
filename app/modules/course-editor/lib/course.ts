import { eq, or, sql } from "drizzle-orm";
import {
  categories,
  courses,
  lessons,
  modules,
  users,
  type CourseStatus,
} from "~/db/schema";
import { markdown } from "~/lib/text";
import type { Db } from "./db";

export function getCourseWithDetails(db: Db, id: number) {
  const course = db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      salesCopy: courses.salesCopy,
      instructorId: courses.instructorId,
      categoryId: courses.categoryId,
      status: courses.status,
      coverImageUrl: courses.coverImageUrl,
      price: courses.price,
      pppEnabled: courses.pppEnabled,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
      instructorName: users.name,
      instructorAvatarUrl: users.avatarUrl,
      instructorBio: users.bio,
      categoryName: categories.name,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .innerJoin(categories, eq(courses.categoryId, categories.id))
    .where(eq(courses.id, id))
    .get();

  if (!course) return null;

  const courseModules = db
    .select()
    .from(modules)
    .where(eq(modules.courseId, id))
    .orderBy(modules.position)
    .all();

  const moduleIds = courseModules.map((m) => m.id);

  const courseLessons =
    moduleIds.length > 0
      ? db
          .select()
          .from(lessons)
          .where(or(...moduleIds.map((mid) => eq(lessons.moduleId, mid))))
          .orderBy(lessons.position)
          .all()
      : [];

  return {
    ...course,
    modules: courseModules.map((mod) => ({
      ...mod,
      lessons: courseLessons.filter((l) => l.moduleId === mod.id),
    })),
  };
}

export function getLessonCountForCourse(db: Db, courseId: number) {
  const courseModules = db
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.courseId, courseId))
    .all();

  if (courseModules.length === 0) return 0;

  const count = db
    .select({ count: sql<number>`count(*)` })
    .from(lessons)
    .where(or(...courseModules.map((m) => eq(lessons.moduleId, m.id))))
    .get();

  return count?.count ?? 0;
}

export function updateCourse(
  db: Db,
  id: number,
  title: string,
  description: string
) {
  return db
    .update(courses)
    .set({ title, description, updatedAt: new Date().toISOString() })
    .where(eq(courses.id, id))
    .returning()
    .get();
}

export function updateCourseStatus(db: Db, id: number, status: CourseStatus) {
  return db
    .update(courses)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(courses.id, id))
    .returning()
    .get();
}

export function updateCourseSalesCopy(db: Db, id: number, salesCopy: string) {
  if (salesCopy.trim().length === 0) {
    throw new Error("Sales copy cannot be empty");
  }

  return db
    .update(courses)
    .set({
      salesCopy: markdown(salesCopy),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(courses.id, id))
    .returning()
    .get();
}

export function updateCoursePrice(db: Db, id: number, price: number) {
  return db
    .update(courses)
    .set({ price, updatedAt: new Date().toISOString() })
    .where(eq(courses.id, id))
    .returning()
    .get();
}

export function updateCoursePppEnabled(
  db: Db,
  id: number,
  pppEnabled: boolean
) {
  return db
    .update(courses)
    .set({ pppEnabled, updatedAt: new Date().toISOString() })
    .where(eq(courses.id, id))
    .returning()
    .get();
}
