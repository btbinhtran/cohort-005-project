import { db } from "~/db";
import type { CourseDecisions } from "~/modules/permissions/course-permissions.server";
import { loadCoursePage } from "./lib/course-page";
import type { Db } from "./lib/course-queries";
import { rateCourse } from "./lib/ratings";

/**
 * The course detail entry point bound to a database: the public course page
 * and the star rating a learner gives it. The app uses `courseDetail`; tests
 * build their own against a test database.
 */
export function createCourseDetail(database: Db) {
  return {
    /**
     * The course page for the person the decisions were made for: the
     * course with its modules and lessons, rendered sales copy, ratings,
     * and, for someone who can take it, their progress and next lesson.
     * Includes the refund offer, as of `now`, for an enrolled person. Null
     * when the course is missing.
     */
    loadCoursePage(
      decisions: Extract<CourseDecisions, { found: true }>,
      now: Date
    ) {
      return loadCoursePage(database, decisions, now);
    },

    /**
     * Records the person's rating for the course, replacing any earlier one.
     * Throws for a rating outside MIN_RATING..MAX_RATING or a missing course.
     */
    rateCourse(input: { userId: number; courseId: number; rating: number }) {
      return rateCourse(database, input);
    },
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const courseDetail = /* @__PURE__ */ createCourseDetail(db);
