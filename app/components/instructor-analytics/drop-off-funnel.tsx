import type {
  CourseFunnel,
  FunnelLesson,
} from "~/modules/instructor-analytics/index.server";

/** One lesson's bar, sized against the enrolled count. */
function FunnelRow({
  lesson,
  enrolledCount,
}: {
  lesson: FunnelLesson;
  enrolledCount: number;
}) {
  const share =
    enrolledCount === 0 ? 0 : (lesson.reachedCount / enrolledCount) * 100;

  return (
    <div className="flex items-center gap-3 py-1.5 text-sm">
      <div
        className="w-48 shrink-0 truncate text-muted-foreground"
        title={lesson.title}
      >
        {lesson.title}
      </div>
      <div className="h-4 flex-1 rounded bg-muted">
        <div
          className="h-4 rounded bg-primary/70 transition-all"
          style={{ width: `${share}%` }}
        />
      </div>
      <div className="w-10 shrink-0 text-right font-medium tabular-nums">
        {lesson.reachedCount}
      </div>
      {/* The drop is spelled out beside each bar so the worst lesson can be
          found by reading rather than by comparing bar lengths by eye. */}
      <div className="w-16 shrink-0 text-right text-xs tabular-nums">
        {lesson.dropFromPrevious > 0 ? (
          <span className="font-medium text-destructive">
            −{lesson.dropFromPrevious}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
    </div>
  );
}

export function DropOffFunnel({ funnel }: { funnel: CourseFunnel }) {
  if (funnel.modules.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        This course has no lessons yet, so there is nothing to drop off from.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {funnel.modules.map((module) => (
        <div key={module.moduleId}>
          {/* Grouped by module because that is how instructors talk about a
              course — "nobody survives module 3". */}
          <div className="flex items-baseline justify-between gap-4 border-b pb-1">
            <h3 className="text-sm font-semibold">{module.title}</h3>
            <p className="text-xs text-muted-foreground tabular-nums">
              {module.reachedCount} of {funnel.enrolledCount} reached
              {module.dropWithin > 0 && `, ${module.dropWithin} lost inside`}
            </p>
          </div>
          <div className="mt-2">
            {module.lessons.map((lesson) => (
              <FunnelRow
                key={lesson.lessonId}
                lesson={lesson}
                enrolledCount={funnel.enrolledCount}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
