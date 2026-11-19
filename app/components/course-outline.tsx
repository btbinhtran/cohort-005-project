import { Link, type useFetcher } from "react-router";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Clock, Eye, FileEdit, GripVertical } from "lucide-react";
import { formatDuration } from "~/lib/utils";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  DeleteModuleButton,
  InlineEditableModuleTitle,
} from "~/components/course-editor-module-controls";
import {
  AddLessonForm,
  DeleteLessonButton,
  InlineEditableLessonTitle,
} from "~/components/course-editor-lesson-controls";

type Fetcher = ReturnType<typeof useFetcher>;

export type CourseOutlineLesson = {
  id: number;
  title: string;
  durationMinutes: number | null;
};

export type CourseOutlineModule = {
  id: number;
  title: string;
  lessons: CourseOutlineLesson[];
};

export type CourseOutlineProps = {
  course: { id: number; slug: string; modules: CourseOutlineModule[] };
  // The fetchers belong to the page, so a reorder still reports back after
  // the instructor leaves the Content tab.
  reorderFetcher: Fetcher;
  lessonReorderFetcher: Fetcher;
};

/** The drag-and-drop list of a course's modules and their lessons. */
export function CourseOutline({
  course,
  reorderFetcher,
  lessonReorderFetcher,
}: CourseOutlineProps) {
  function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    if (
      result.source.droppableId === result.destination.droppableId &&
      result.source.index === result.destination.index
    ) {
      return;
    }

    if (result.type === "module") {
      const reordered = Array.from(course.modules);
      const [moved] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, moved);

      const moduleIds = reordered.map((m) => m.id);
      reorderFetcher.submit(
        { intent: "reorder-modules", moduleIds: JSON.stringify(moduleIds) },
        { method: "post" }
      );
    } else if (result.type === "lesson") {
      const sourceModuleId = parseInt(
        result.source.droppableId.replace("lessons-", ""),
        10
      );
      const destModuleId = parseInt(
        result.destination.droppableId.replace("lessons-", ""),
        10
      );

      if (sourceModuleId === destModuleId) {
        // Reorder within the same module
        const mod = course.modules.find((m) => m.id === sourceModuleId);
        if (!mod) return;

        const reordered = Array.from(mod.lessons);
        const [moved] = reordered.splice(result.source.index, 1);
        reordered.splice(result.destination.index, 0, moved);

        const lessonIds = reordered.map((l) => l.id);
        lessonReorderFetcher.submit(
          {
            intent: "reorder-lessons",
            moduleId: String(sourceModuleId),
            lessonIds: JSON.stringify(lessonIds),
          },
          { method: "post" }
        );
      } else {
        // Move lesson to a different module
        const sourceMod = course.modules.find((m) => m.id === sourceModuleId);
        if (!sourceMod) return;

        const lesson = sourceMod.lessons[result.source.index];
        if (!lesson) return;

        // Target position is 1-based (destination index + 1)
        const targetPosition = result.destination.index + 1;

        lessonReorderFetcher.submit(
          {
            intent: "move-lesson",
            lessonId: String(lesson.id),
            targetModuleId: String(destModuleId),
            targetPosition: String(targetPosition),
          },
          { method: "post" }
        );
      }
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="modules" type="module">
        {(provided) => (
          <div
            className="space-y-4"
            ref={provided.innerRef}
            {...provided.droppableProps}
          >
            {course.modules.map((mod, index) => (
              <Draggable
                key={mod.id}
                draggableId={String(mod.id)}
                index={index}
              >
                {(provided, snapshot) => (
                  <div ref={provided.innerRef} {...provided.draggableProps}>
                    <Card
                      className={
                        snapshot.isDragging
                          ? "shadow-lg ring-2 ring-primary/50"
                          : ""
                      }
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <div
                              {...provided.dragHandleProps}
                              className="cursor-grab active:cursor-grabbing rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                            >
                              <GripVertical className="size-5" />
                            </div>
                            <div className="flex-1">
                              <InlineEditableModuleTitle
                                value={mod.title}
                                moduleId={mod.id}
                              />
                              <p className="mt-1 px-2 text-sm text-muted-foreground">
                                {mod.lessons.length}{" "}
                                {mod.lessons.length === 1
                                  ? "lesson"
                                  : "lessons"}
                              </p>
                            </div>
                          </div>
                          <DeleteModuleButton
                            moduleId={mod.id}
                            moduleTitle={mod.title}
                          />
                        </div>
                      </CardHeader>
                      <CardContent>
                        {mod.lessons.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-muted-foreground">
                            No lessons yet.
                          </p>
                        ) : (
                          <Droppable
                            droppableId={`lessons-${mod.id}`}
                            type="lesson"
                          >
                            {(lessonDropProvided) => (
                              <ul
                                className="space-y-1"
                                ref={lessonDropProvided.innerRef}
                                {...lessonDropProvided.droppableProps}
                              >
                                {mod.lessons.map((lesson, lessonIndex) => (
                                  <Draggable
                                    key={lesson.id}
                                    draggableId={`lesson-${lesson.id}`}
                                    index={lessonIndex}
                                  >
                                    {(lessonProvided, lessonSnapshot) => (
                                      <li
                                        ref={lessonProvided.innerRef}
                                        {...lessonProvided.draggableProps}
                                      >
                                        <div
                                          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm${
                                            lessonSnapshot.isDragging
                                              ? " bg-muted shadow-md ring-1 ring-primary/30"
                                              : ""
                                          }`}
                                        >
                                          <div
                                            {...lessonProvided.dragHandleProps}
                                            className="cursor-grab active:cursor-grabbing rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                                          >
                                            <GripVertical className="size-4" />
                                          </div>
                                          <div className="flex-1">
                                            <InlineEditableLessonTitle
                                              value={lesson.title}
                                              lessonId={lesson.id}
                                            />
                                          </div>
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
                                          <Link
                                            to={`/courses/${course.slug}/lessons/${lesson.id}`}
                                            title="View lesson"
                                          >
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                            >
                                              <Eye className="size-3.5" />
                                            </Button>
                                          </Link>
                                          <Link
                                            to={`/instructor/${course.id}/lessons/${lesson.id}`}
                                            title="Edit lesson"
                                          >
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                            >
                                              <FileEdit className="size-3.5" />
                                            </Button>
                                          </Link>
                                          <DeleteLessonButton
                                            lessonId={lesson.id}
                                            lessonTitle={lesson.title}
                                          />
                                        </div>
                                      </li>
                                    )}
                                  </Draggable>
                                ))}
                                {lessonDropProvided.placeholder}
                              </ul>
                            )}
                          </Droppable>
                        )}
                        <AddLessonForm moduleId={mod.id} />
                      </CardContent>
                    </Card>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
