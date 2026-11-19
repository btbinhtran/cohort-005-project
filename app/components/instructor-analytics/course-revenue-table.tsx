import { PLATFORM_FEE_PERCENT, formatMoney } from "~/lib/analytics";
import type { InstructorAnalytics } from "~/modules/instructor-analytics/index.server";

/** Revenue per course, or the empty copy when there are no sales. */
export function CourseRevenueTable({
  revenueRows,
}: {
  revenueRows: InstructorAnalytics["courses"];
}) {
  return revenueRows.length === 0 ? (
    <p className="py-12 text-center text-sm text-muted-foreground">
      No sales in this period yet.
    </p>
  ) : (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="pb-2 font-medium">Course</th>
          <th className="pb-2 text-right font-medium">Sales</th>
          <th className="pb-2 text-right font-medium">Gross</th>
          <th className="pb-2 text-right font-medium">
            Fee ({PLATFORM_FEE_PERCENT}%)
          </th>
          <th className="pb-2 text-right font-medium">Net</th>
        </tr>
      </thead>
      <tbody>
        {revenueRows.map((course) => (
          <tr key={course.courseId} className="border-b">
            <td className="py-3 font-medium">{course.title}</td>
            <td className="py-3 text-right tabular-nums">
              {course.purchaseCount}
            </td>
            <td className="py-3 text-right tabular-nums">
              {formatMoney(course.grossCents)}
            </td>
            <td className="py-3 text-right tabular-nums text-muted-foreground">
              {formatMoney(course.feeCents)}
            </td>
            <td className="py-3 text-right font-medium tabular-nums">
              {formatMoney(course.netCents)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
