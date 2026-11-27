import { db } from "~/db";
import {
  getCatalogueStats,
  getFeaturedCourses,
  type Db,
} from "./lib/landing-queries";

export type {
  CatalogueStats,
  FeaturedCourse,
} from "./lib/landing-queries";
export { FEATURED_COURSE_LIMIT } from "./lib/landing-queries";

/**
 * The landing page entry point bound to a database. The app uses
 * `landingPage`; tests build their own against a test database.
 */
export function createLandingPage(database: Db) {
  return {
    /**
     * What the landing page shows about the catalogue: the newest published
     * courses, up to FEATURED_COURSE_LIMIT, each with its lesson count, and
     * totals over published courses only — courses, their lessons, the
     * instructors who teach them and the categories they sit in.
     */
    load() {
      return {
        featuredCourses: getFeaturedCourses(database),
        stats: getCatalogueStats(database),
      };
    },
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const landingPage = /* @__PURE__ */ createLandingPage(db);
