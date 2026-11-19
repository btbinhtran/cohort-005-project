import { isNull } from "drizzle-orm";
import { countRows, db, type User } from "./db";
import { daysAgo } from "./helpers";
import * as schema from "../../app/db/schema";
import { markdown } from "../../app/lib/text";

export function seedComments({
  admin,
  instructor1,
  instructor2,
  students,
  course1LessonIds,
  course2LessonIds,
}: {
  admin: User;
  instructor1: User;
  instructor2: User;
  students: User[];
  course1LessonIds: number[];
  course2LessonIds: number[];
}) {
  // ─── Lesson Comments ───
  // Covers every state the Q&A feature can be in, so the instructor queue and
  // the lesson thread both have something real to render: answered threads,
  // questions still waiting (two of them stale enough to flag), a question only
  // another student replied to (still unanswered), an edited comment, and a
  // deleted question kept as a tombstone because it has a reply.
  // Only enrolled students comment.

  function comment(
    values: Omit<typeof schema.comments.$inferInsert, "body"> & { body: string }
  ) {
    const [row] = db
      .insert(schema.comments)
      .values({ ...values, body: markdown(values.body) })
      .returning()
      .all();
    return row;
  }

  // Answered: student asks, Sarah answers, student confirms.
  const c1q1 = comment({
    lessonId: course1LessonIds[2],
    userId: students[0].id,
    body: "I'm getting `tsc: command not found` when I run the compile step. Did I miss an install somewhere?",
    createdAt: daysAgo(30),
  });
  comment({
    lessonId: course1LessonIds[2],
    userId: instructor1.id,
    parentId: c1q1.id,
    body: "That usually means TypeScript is installed locally but not on your PATH. Two options:\n\n```bash\nnpx tsc --version\n```\n\nor install it globally with `npm i -g typescript`. I'd stick with `npx` — it keeps the version pinned to the project.",
    createdAt: daysAgo(29),
  });
  comment({
    lessonId: course1LessonIds[2],
    userId: students[0].id,
    parentId: c1q1.id,
    body: "`npx` did it. Thank you!",
    createdAt: daysAgo(29),
  });

  // Waiting, and stale enough to flag amber in the queue.
  comment({
    lessonId: course1LessonIds[7],
    userId: students[2].id,
    body: "Why does this fail to infer? I expected `T` to come out as `string`.\n\n```typescript\nfunction first<T>(items: T[]): T {\n  return items[0];\n}\n\nconst x = first([]);\n```",
    createdAt: daysAgo(6),
  });

  // Waiting, but posted today — should look calm in the queue.
  comment({
    lessonId: course1LessonIds[4],
    userId: students[4].id,
    body: "Is there a reason to prefer `interface` over `type` here, or is it purely style?",
    createdAt: daysAgo(1),
  });

  // Another student replied, but no staff has — still counts as unanswered.
  const c1q4 = comment({
    lessonId: course1LessonIds[3],
    userId: students[1].id,
    body: "Does strict mode change anything about how this example behaves?",
    createdAt: daysAgo(4),
  });
  comment({
    lessonId: course1LessonIds[3],
    userId: students[0].id,
    parentId: c1q4.id,
    body: "I think it only affects the null checks, but I'd like a second opinion too.",
    createdAt: daysAgo(4),
  });

  // Edited by its author — renders an "(edited)" marker.
  const c1q5 = comment({
    lessonId: course1LessonIds[0],
    userId: students[1].id,
    body: "Coming from JavaScript, how much of this will feel familiar? (Edited to add: I've used JSDoc types before.)",
    createdAt: daysAgo(40),
    editedAt: daysAgo(39),
  });
  comment({
    lessonId: course1LessonIds[0],
    userId: instructor1.id,
    parentId: c1q5.id,
    body: "Most of it. If you've written JSDoc types you already understand the mental model — the syntax is just less noisy.",
    createdAt: daysAgo(39),
  });

  // Deleted question that keeps its reply — renders as a tombstone.
  const c1q6 = comment({
    lessonId: course1LessonIds[1],
    userId: students[4].id,
    body: "Posted this on the wrong lesson, sorry!",
    createdAt: daysAgo(12),
    deletedAt: daysAgo(12),
  });
  comment({
    lessonId: course1LessonIds[1],
    userId: instructor1.id,
    parentId: c1q6.id,
    body: "No problem at all — asked and answered over on the generics lesson.",
    createdAt: daysAgo(12),
  });

  // Course 2: waiting a long time.
  comment({
    lessonId: course2LessonIds[2],
    userId: students[3].id,
    body: "When would you return a 422 instead of a 400? The distinction still isn't clicking for me.",
    createdAt: daysAgo(9),
  });

  // Course 2: answered by an admin rather than the owning instructor.
  const c2q2 = comment({
    lessonId: course2LessonIds[0],
    userId: students[2].id,
    body: "Are the example requests in this lesson hitting a real API, or is it all mocked?",
    createdAt: daysAgo(14),
  });
  comment({
    lessonId: course2LessonIds[0],
    userId: admin.id,
    parentId: c2q2.id,
    body: "All mocked — nothing leaves your machine. The repo linked on the lesson has the fixtures.",
    createdAt: daysAgo(13),
  });

  // An instructor's own top-level post never queues up as work for themselves.
  comment({
    lessonId: course2LessonIds[1],
    userId: instructor2.id,
    body: "Heads up: the status code table was updated this week to include 418. Refresh if you cached the old one.",
    createdAt: daysAgo(7),
  });

  console.log(
    `Created ${countRows(schema.comments)} lesson comments across ${countRows(schema.comments, isNull(schema.comments.parentId))} threads.`
  );
}
