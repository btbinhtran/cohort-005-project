import { Link } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PagerLesson = { id: number; title: string };

export function LessonPager({
  course,
  prevLesson,
  nextLesson,
}: {
  course: { title: string; slug: string };
  prevLesson: PagerLesson | null;
  nextLesson: PagerLesson | null;
}) {
  return (
    <div className="flex items-center justify-between border-t pt-6">
      {prevLesson ? (
        <Link
          to={`/courses/${course.slug}/lessons/${prevLesson.id}`}
          className="flex items-center gap-2 text-sm hover:text-foreground text-muted-foreground"
        >
          <ChevronLeft className="size-4" />
          <div>
            <div className="text-xs text-muted-foreground">Previous</div>
            <div className="font-medium text-foreground">
              {prevLesson.title}
            </div>
          </div>
        </Link>
      ) : (
        <div />
      )}

      {nextLesson ? (
        <Link
          to={`/courses/${course.slug}/lessons/${nextLesson.id}`}
          className="flex items-center gap-2 text-right text-sm hover:text-foreground text-muted-foreground"
        >
          <div>
            <div className="text-xs text-muted-foreground">Next</div>
            <div className="font-medium text-foreground">
              {nextLesson.title}
            </div>
          </div>
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <Link
          to={`/courses/${course.slug}`}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <div>
            <div className="text-xs text-muted-foreground">Back to</div>
            <div className="font-medium text-foreground">{course.title}</div>
          </div>
          <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
