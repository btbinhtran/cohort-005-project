import { db } from "~/db";
import { bindDb, type Db } from "./lib/db";
import {
  createOption,
  createQuestion,
  createQuiz,
  deleteQuiz,
  getLessonById,
  getModuleById,
  getQuizByLessonId,
  getQuizWithQuestions,
} from "./lib/quizzes";

export { wizardDataSchema } from "./lib/wizard-schema";

/**
 * The instructor quiz builder bound to a database: a lesson's quiz with its
 * questions and options, and the writes that build or remove it. The app
 * uses `quizBuilder`, which reads the app database; tests build their own
 * against a test database.
 */
export function createQuizBuilder(database: Db) {
  return {
    getModuleById: bindDb(database, getModuleById),
    getLessonById: bindDb(database, getLessonById),
    getQuizByLessonId: bindDb(database, getQuizByLessonId),
    getQuizWithQuestions: bindDb(database, getQuizWithQuestions),
    createQuiz: bindDb(database, createQuiz),
    deleteQuiz: bindDb(database, deleteQuiz),
    createQuestion: bindDb(database, createQuestion),
    createOption: bindDb(database, createOption),
  };
}

// Pure so a route importing this only for its loader and action doesn't pull
// the database into the client bundle (see `~/db`).
export const quizBuilder = /* @__PURE__ */ createQuizBuilder(db);
