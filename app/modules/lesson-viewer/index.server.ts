import { db } from "~/db";
import type { CourseDecisions } from "~/modules/permissions/course-permissions.server";
import type { Db } from "./lib/course-outline";
import { loadLessonPage } from "./lib/lesson-page";
import { markLessonComplete } from "./lib/progress";
import { computeResult, getQuizById } from "./lib/quiz";
import { getCommentById } from "./lib/thread";

/**
 * The lesson viewer entry point bound to a database: what a learner sees on
 * a lesson page and what they do there (progress and quizzes). The app uses
 * `lessonViewer`; tests build their own against a test database.
 */
export function createLessonViewer(database: Db) {
  return {
    /**
     * The lesson page for the person the decisions were made for: a locked
     * view (title, outline and the denial reason) when they cannot view the
     * course, otherwise the full lesson. Viewing marks the lesson in progress
     * for people who can take the course. Null when the lesson is missing.
     */
    loadLessonPage(
      decisions: Extract<CourseDecisions, { found: true }>,
      lessonId: number
    ) {
      return loadLessonPage(database, decisions, lessonId);
    },

    markLessonComplete(userId: number, lessonId: number) {
      return markLessonComplete(database, userId, lessonId);
    },

    /** The comment with this id, deleted or not, in whatever lesson. */
    getComment(commentId: number) {
      return getCommentById(database, commentId);
    },

    /** The quiz with this id, in whatever lesson. */
    getQuiz(quizId: number) {
      return getQuizById(database, quizId);
    },

    /**
     * Scores the answers (question id to option id), records the attempt
     * and its answers, and returns the score, grade and per-question
     * results. Null when the quiz is missing or scoring fails.
     */
    submitQuiz(input: {
      userId: number;
      quizId: number;
      selectedAnswers: Record<number, number>;
    }) {
      return computeResult(database, input);
    },
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const lessonViewer = /* @__PURE__ */ createLessonViewer(db);
