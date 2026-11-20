import type { CourseDecisions } from "~/modules/permissions/course-permissions.server";
import { getRefundOffer, type RefundOffer } from "~/lib/refunds.server";
import { renderMarkdown } from "~/lib/markdown.server";
import {
  calculateProgress,
  getCourseWithDetails,
  getLessonCountForCourse,
  getLessonProgressForCourse,
  getNextIncompleteLesson,
  type Db,
} from "./course-queries";
import { findRating, getCourseRatingSummary } from "./ratings";

/**
 * Everything the course page shows apart from the price, given the decisions
 * for the person viewing it. Returns null when the course is missing.
 */
export async function loadCoursePage(
  database: Db,
  decisions: Extract<CourseDecisions, { found: true }>,
  now: Date
) {
  const { course, person, enrolled, view, take } = decisions;
  const currentUserId = person?.id ?? null;
  const canView = view.allowed;
  const canTake = take.allowed;
  const countryLock =
    !take.allowed && take.reason.kind === "country-lock" ? take.reason : null;

  const courseWithDetails = getCourseWithDetails(database, course.id);
  if (!courseWithDetails) {
    return null;
  }

  const lessonCount = getLessonCountForCourse(database, course.id);

  let progress = 0;
  const lessonProgressMap: Record<number, string> = {};
  let nextLessonId: number | null = null;
  let refundOffer: RefundOffer | null = null;

  if (person && enrolled) {
    refundOffer = getRefundOffer(database, person.id, course.id, now);
  }

  // Progress is shown only to someone who can take the course.
  if (person && canTake) {
    progress = calculateProgress(database, {
      userId: person.id,
      courseId: course.id,
      weightByDuration: false,
    });

    const progressRecords = getLessonProgressForCourse(
      database,
      person.id,
      course.id
    );
    for (const record of progressRecords) {
      lessonProgressMap[record.lessonId] = record.status;
    }

    const nextLesson = getNextIncompleteLesson(database, person.id, course.id);
    nextLessonId = nextLesson?.id ?? null;
  }

  // Render sales copy from Markdown to HTML server-side
  const salesCopyHtml = await renderMarkdown(courseWithDetails.salesCopy);

  const ratingSummary = getCourseRatingSummary(database, course.id);
  const userRating = currentUserId
    ? (findRating(database, currentUserId, course.id)?.rating ?? null)
    : null;

  return {
    course: courseWithDetails,
    salesCopyHtml,
    lessonCount,
    enrolled,
    canView,
    canTake,
    countryLock,
    progress,
    lessonProgressMap,
    nextLessonId,
    currentUserId,
    ratingSummary,
    userRating,
    refundOffer,
  };
}
