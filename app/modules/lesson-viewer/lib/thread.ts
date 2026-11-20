import { asc, eq } from "drizzle-orm";
import {
  comments,
  courses,
  lessons,
  modules,
  users,
  UserRole,
} from "~/db/schema";
import { renderComment } from "~/lib/comment-markdown.server";
import { markdown, type Markdown } from "~/lib/text";
import type { Db } from "./course-outline";

type CommentAuthor = {
  id: number;
  name: string;
  avatarUrl: string | null;
  isInstructor: boolean;
  isPlatformAdmin: boolean;
};

type ThreadComment = {
  id: number;
  body: Markdown;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  author: CommentAuthor;
  replies: ThreadComment[];
};

type RenderedThreadComment = Omit<ThreadComment, "replies"> & {
  bodyHtml: string;
  replies: RenderedThreadComment[];
};

function getCourseForLesson(database: Db, lessonId: number) {
  return database
    .select({
      courseId: courses.id,
      courseTitle: courses.title,
      courseSlug: courses.slug,
      instructorId: courses.instructorId,
    })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(eq(lessons.id, lessonId))
    .get();
}

export function getCommentById(database: Db, commentId: number) {
  return database
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .get();
}

export function getLessonThread(
  database: Db,
  lessonId: number
): ThreadComment[] {
  const course = getCourseForLesson(database, lessonId);
  if (!course) return [];

  const rows = database
    .select({
      id: comments.id,
      body: comments.body,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      authorId: users.id,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
      authorRole: users.role,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.lessonId, lessonId))
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .all();

  const toThreadComment = (row: (typeof rows)[number]): ThreadComment => {
    const deleted = row.deletedAt !== null;
    return {
      id: row.id,
      body: deleted ? markdown("") : row.body,
      createdAt: row.createdAt,
      editedAt: deleted ? null : row.editedAt,
      deleted,
      author: {
        id: row.authorId,
        name: row.authorName,
        avatarUrl: row.authorAvatarUrl,
        isInstructor: row.authorId === course.instructorId,
        isPlatformAdmin: row.authorRole === UserRole.Admin,
      },
      replies: [],
    };
  };

  const topLevel: ThreadComment[] = [];
  const byId = new Map<number, ThreadComment>();

  for (const row of rows) {
    if (row.parentId !== null) continue;
    const comment = toThreadComment(row);
    byId.set(comment.id, comment);
    topLevel.push(comment);
  }

  for (const row of rows) {
    if (row.parentId === null || row.deletedAt !== null) continue;
    byId.get(row.parentId)?.replies.push(toThreadComment(row));
  }

  // A deleted question with no replies left has nothing worth showing.
  return topLevel.filter((c) => !c.deleted || c.replies.length > 0);
}

/**
 * Renders every comment body to sanitised HTML, preserving the reply nesting.
 * Comments are untrusted input, so this must be renderComment — never
 * renderMarkdown, which lets raw HTML through for trusted lesson content.
 */
export async function renderThread(
  nodes: ThreadComment[]
): Promise<RenderedThreadComment[]> {
  return Promise.all(
    nodes.map(async (node) => ({
      ...node,
      bodyHtml: node.deleted ? "" : await renderComment(node.body),
      replies: await renderThread(node.replies),
    }))
  );
}
