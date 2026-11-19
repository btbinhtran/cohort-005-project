import { db } from "~/db";
import {
  getInstructorAnalytics,
  type AnalyticsViewer,
} from "./lib/instructor-analytics";
import type { Db } from "./lib/scope";

export type {
  AnalyticsViewer,
  InstructorAnalytics,
  RefundExposure,
} from "./lib/instructor-analytics";
export type { CourseCountryRevenue } from "./lib/country-revenue";
export type {
  CourseFunnel,
  CourseProgressSummary,
  FunnelLesson,
} from "./lib/course-progress";
export type { QuizPassRate } from "./lib/quiz-pass-rates";
export type { RevenueSeries } from "./lib/revenue-over-time";

/**
 * Instructor analytics bound to a database. The app uses
 * `instructorAnalytics`, which reads the app database; tests build their own
 * against a test database.
 */
export function createInstructorAnalytics(database: Db) {
  return {
    /**
     * Every figure on the instructor analytics page.
     *
     * Never throws on bad params: an unknown range, tab, instructor or course
     * falls back to its default. `now` is the only clock read, so the same
     * database, params and `now` always produce the same result.
     */
    get(viewer: AnalyticsViewer, params: URLSearchParams, now: Date) {
      return getInstructorAnalytics(database, viewer, params, now);
    },
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const instructorAnalytics =
  /* @__PURE__ */ createInstructorAnalytics(db);
