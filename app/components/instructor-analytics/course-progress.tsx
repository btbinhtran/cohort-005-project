import type { CourseProgressSummary } from "~/modules/instructor-analytics/index.server";
import { Card, CardContent } from "~/components/ui/card";

/** The two completion figures, side by side and deliberately not merged. */
export function CourseProgress({
  progress,
}: {
  progress: CourseProgressSummary;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardContent className="p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Average progress <span className="font-normal">· all time</span>
          </div>
          <div className="mt-2 text-3xl font-bold">
            {progress.averageProgressPercent === null
              ? "—"
              : `${progress.averageProgressPercent}%`}
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${progress.averageProgressPercent ?? 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Lessons completed per enrolled student, across{" "}
            {progress.enrolledCount}{" "}
            {progress.enrolledCount === 1 ? "student" : "students"} and{" "}
            {progress.totalLessons}{" "}
            {progress.totalLessons === 1 ? "lesson" : "lessons"}.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="text-sm font-medium text-muted-foreground">
            Students finished <span className="font-normal">· all time</span>
          </div>
          <div className="mt-2 text-3xl font-bold">
            {progress.finishedCount}
          </div>
          {/* A count, and deliberately not a third percentage: several
              defensible completion rates exist, they disagree, and naming one
              of them here would be wrong for whoever is reading. */}
          <p className="mt-2 text-xs text-muted-foreground">
            Students who have completed every lesson, of{" "}
            {progress.enrolledCount} enrolled.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
