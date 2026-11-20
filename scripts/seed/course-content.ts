import { db } from "./db";
import { daysAgo } from "./helpers";
import * as schema from "../../app/db/schema";
import { markdown } from "../../app/lib/text";

export type LessonSpec = {
  title: string;
  duration: number;
  videoUrl?: string;
  githubRepoUrl?: string;
  content?: string;
};

export type ModuleSpec = { title: string; lessons: LessonSpec[] };

// Inserts a course's modules and lessons in order and returns the lesson ids,
// flattened module by module. Positions are 1-based.
export function insertCourseContent(
  courseId: number,
  moduleSpecs: ModuleSpec[],
  startDaysAgo: number
): number[] {
  const lessonIds: number[] = [];

  for (let mi = 0; mi < moduleSpecs.length; mi++) {
    const modData = moduleSpecs[mi];
    const [mod] = db
      .insert(schema.modules)
      .values({
        courseId,
        title: modData.title,
        position: mi + 1,
        createdAt: daysAgo(startDaysAgo - mi),
      })
      .returning()
      .all();

    for (let li = 0; li < modData.lessons.length; li++) {
      const lessonData = modData.lessons[li];
      const [lesson] = db
        .insert(schema.lessons)
        .values({
          moduleId: mod.id,
          title: lessonData.title,
          content: lessonData.content ? markdown(lessonData.content) : null,
          videoUrl: lessonData.videoUrl ?? null,
          githubRepoUrl: lessonData.githubRepoUrl ?? null,
          position: li + 1,
          durationMinutes: lessonData.duration,
          createdAt: daysAgo(startDaysAgo - mi),
        })
        .returning()
        .all();
      lessonIds.push(lesson.id);
    }
  }

  return lessonIds;
}
