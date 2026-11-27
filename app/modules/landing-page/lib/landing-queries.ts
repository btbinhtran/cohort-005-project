import { and, countDistinct, desc, eq, inArray, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "~/db/schema";
import { categories, courses, lessons, modules, users } from "~/db/schema";

export type Db = BetterSQLite3Database<typeof schema>;

export const FEATURED_COURSE_LIMIT = 3;

const isPublished = eq(courses.status, schema.CourseStatus.Published);

export type FeaturedCourse = {
  id: number;
  title: string;
  slug: string;
  description: string;
  coverImageUrl: string | null;
  instructorName: string;
  categoryName: string;
  lessonCount: number;
};

export type CatalogueStats = {
  courses: number;
  lessons: number;
  instructors: number;
  categories: number;
};

export function getFeaturedCourses(database: Db): FeaturedCourse[] {
  const newest = database
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      coverImageUrl: courses.coverImageUrl,
      instructorName: users.name,
      categoryName: categories.name,
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .innerJoin(categories, eq(courses.categoryId, categories.id))
    .where(isPublished)
    .orderBy(desc(courses.createdAt), desc(courses.id))
    .limit(FEATURED_COURSE_LIMIT)
    .all();

  const counts = getLessonCounts(
    database,
    newest.map((course) => course.id)
  );
  return newest.map((course) => ({
    ...course,
    lessonCount: counts.get(course.id) ?? 0,
  }));
}

function getLessonCounts(database: Db, courseIds: number[]) {
  const rows = database
    .select({ courseId: modules.courseId, count: sql<number>`count(*)` })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(inArray(modules.courseId, courseIds))
    .groupBy(modules.courseId)
    .all();
  return new Map(rows.map((row) => [row.courseId, row.count]));
}

export function getCatalogueStats(database: Db): CatalogueStats {
  const catalogue = database
    .select({
      courses: countDistinct(courses.id),
      instructors: countDistinct(courses.instructorId),
      categories: countDistinct(courses.categoryId),
    })
    .from(courses)
    .where(isPublished)
    .get();

  const lessonTotal = database
    .select({ count: sql<number>`count(*)` })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, and(eq(modules.courseId, courses.id), isPublished))
    .get();

  return {
    courses: catalogue?.courses ?? 0,
    lessons: lessonTotal?.count ?? 0,
    instructors: catalogue?.instructors ?? 0,
    categories: catalogue?.categories ?? 0,
  };
}
