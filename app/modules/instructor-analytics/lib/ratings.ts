import { count, eq, sql } from "drizzle-orm";
import { courseRatings, courses } from "~/db/schema";
import type { AnalyticsRange } from "~/lib/analytics";
import { scopeOn, type Db } from "./scope";

export type RatingSummary = {
  average: number | null;
  count: number;
};

export function getRatingSummary(
  db: Db,
  instructorId: number | null,
  range: AnalyticsRange,
  now: Date
): RatingSummary {
  const row = db
    .select({
      average: sql<number | null>`avg(${courseRatings.rating})`,
      count: count(courseRatings.id),
    })
    .from(courseRatings)
    .innerJoin(courses, eq(courseRatings.courseId, courses.id))
    .where(scopeOn(courseRatings.createdAt, instructorId, range, now))
    .get();

  if (!row || row.count === 0 || row.average === null) {
    return { average: null, count: 0 };
  }

  return { average: Math.round(row.average * 10) / 10, count: row.count };
}
