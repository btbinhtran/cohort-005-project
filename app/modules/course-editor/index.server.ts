import { db } from "~/db";
import { bindDb, type Db } from "./lib/db";
import {
  getCourseWithDetails,
  getLessonCountForCourse,
  updateCourse,
  updateCoursePppEnabled,
  updateCoursePrice,
  updateCourseSalesCopy,
  updateCourseStatus,
} from "./lib/course";
import {
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  getLessonById,
  getModuleById,
  moveLessonToModule,
  reorderLessons,
  reorderModules,
  updateLessonTitle,
  updateModuleTitle,
} from "./lib/structure";
import { getEnrollmentCountForCourse, getStudentRoster } from "./lib/roster";

export { courseEditorActionSchema } from "./lib/action-schema";

/**
 * The instructor course editor bound to a database: the course's details,
 * its modules and lessons, and the roster of enrolled students. The app uses
 * `courseEditor`, which reads the app database; tests build their own
 * against a test database.
 */
export function createCourseEditor(database: Db) {
  return {
    getCourseWithDetails: bindDb(database, getCourseWithDetails),
    getLessonCountForCourse: bindDb(database, getLessonCountForCourse),
    getEnrollmentCountForCourse: bindDb(database, getEnrollmentCountForCourse),
    getStudentRoster: bindDb(database, getStudentRoster),
    updateCourse: bindDb(database, updateCourse),
    updateCourseStatus: bindDb(database, updateCourseStatus),
    updateCourseSalesCopy: bindDb(database, updateCourseSalesCopy),
    updateCoursePrice: bindDb(database, updateCoursePrice),
    updateCoursePppEnabled: bindDb(database, updateCoursePppEnabled),
    getModuleById: bindDb(database, getModuleById),
    createModule: bindDb(database, createModule),
    updateModuleTitle: bindDb(database, updateModuleTitle),
    deleteModule: bindDb(database, deleteModule),
    reorderModules: bindDb(database, reorderModules),
    getLessonById: bindDb(database, getLessonById),
    createLesson: bindDb(database, createLesson),
    updateLessonTitle: bindDb(database, updateLessonTitle),
    deleteLesson: bindDb(database, deleteLesson),
    reorderLessons: bindDb(database, reorderLessons),
    moveLessonToModule: bindDb(database, moveLessonToModule),
  };
}

// Pure so a route importing this only for its loader and action doesn't pull
// the database into the client bundle (see `~/db`).
export const courseEditor = /* @__PURE__ */ createCourseEditor(db);
