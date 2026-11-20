import { Link } from "react-router";
import { CheckCircle2, Circle, Clock, Pencil, PlayCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { LessonProgressStatus } from "~/db/schema";
import { formatDuration } from "~/lib/utils";

export function CourseContent({
  course,
  canView,
  isInstructor,
  lessonProgressMap,
}: {
  course: {
    id: number;
    slug: string;
    modules: Array<{
      id: number;
      title: string;
      lessons: Array<{
        id: number;
        title: string;
        durationMinutes: number | null;
      }>;
    }>;
  };
  canView: boolean;
  isInstructor: boolean;
  lessonProgressMap: Record<number, string>;
}) {
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Course Content</h2>
      {course.modules.length === 0 ? (
        <p className="text-muted-foreground">
          No content has been added to this course yet.
        </p>
      ) : (
        <div className="space-y-4">
          {course.modules.map((mod) => (
            <Card key={mod.id}>
              <CardHeader>
                <h3 className="font-semibold">
                  <Link
                    to={`/courses/${course.slug}/${mod.id}`}
                    className="hover:underline"
                  >
                    {mod.title}
                  </Link>
                </h3>
                <p className="text-sm text-muted-foreground">
                  {mod.lessons.length} lessons
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {mod.lessons.map((lesson) => {
                    const status = lessonProgressMap[lesson.id];
                    const isCompleted =
                      status === LessonProgressStatus.Completed;
                    const isLessonInProgress =
                      status === LessonProgressStatus.InProgress;

                    if (isInstructor) {
                      return (
                        <li key={lesson.id}>
                          <Link
                            to={`/instructor/${course.id}/lessons/${lesson.id}`}
                            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
                          >
                            <Pencil className="size-4 shrink-0 text-muted-foreground" />
                            <span className="flex-1">{lesson.title}</span>
                            {lesson.durationMinutes && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="size-3" />
                                {formatDuration(
                                  lesson.durationMinutes,
                                  true,
                                  false,
                                  false
                                )}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    }

                    return (
                      <li key={lesson.id}>
                        {canView ? (
                          <Link
                            to={`/courses/${course.slug}/lessons/${lesson.id}`}
                            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted"
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                            ) : isLessonInProgress ? (
                              <PlayCircle className="size-4 shrink-0 text-blue-500" />
                            ) : (
                              <Circle className="size-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="flex-1">{lesson.title}</span>
                            {lesson.durationMinutes && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="size-3" />
                                {formatDuration(
                                  lesson.durationMinutes,
                                  true,
                                  false,
                                  false
                                )}
                              </span>
                            )}
                          </Link>
                        ) : (
                          <div className="flex items-center gap-3 px-3 py-2 text-sm">
                            <Circle className="size-4 shrink-0 text-muted-foreground" />
                            <span className="flex-1">{lesson.title}</span>
                            {lesson.durationMinutes && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="size-3" />
                                {formatDuration(
                                  lesson.durationMinutes,
                                  true,
                                  false,
                                  false
                                )}
                              </span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
