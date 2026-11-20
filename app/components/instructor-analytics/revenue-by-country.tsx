import { formatMoney } from "~/lib/analytics";
import type { CourseCountryRevenue } from "~/modules/instructor-analytics/index.server";
import { countryName } from "~/lib/ppp";

/** Where a course's buyers are, and what parity pricing costs the seller. */
export function RevenueByCountry({
  breakdown,
}: {
  breakdown: CourseCountryRevenue;
}) {
  if (breakdown.rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        This course has no sales in this period, so there is nowhere to break
        down yet.
      </p>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        {/* The headline the panel exists for: parity discounting is otherwise
            invisible, though it directly sets what the instructor earns — so
            the figure is stated in net, the money they actually keep. */}
        {formatMoney(breakdown.discountedNetCents)} of your{" "}
        {formatMoney(breakdown.netCents)} net earnings (
        {breakdown.discountedSharePercent}%) came from countries with a parity
        discount. Averages are what a sale there actually fetched — list prices
        change and are not kept, so no discount is reconstructed per purchase.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 font-medium">Country</th>
            <th className="pb-2 text-right font-medium">Sales</th>
            <th className="pb-2 text-right font-medium">Average paid</th>
            <th className="pb-2 text-right font-medium">Gross</th>
            <th className="pb-2 text-right font-medium">Net</th>
            <th className="pb-2 text-right font-medium">Share</th>
          </tr>
        </thead>
        <tbody>
          {breakdown.rows.map((row) => (
            <tr key={row.country ?? "unknown"} className="border-b">
              <td className="py-3">
                <span className="font-medium">
                  {row.country === null
                    ? "Not recorded"
                    : countryName(row.country)}
                </span>
                {row.discountPercent !== null && row.discountPercent > 0 && (
                  <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs font-medium">
                    {row.discountPercent}% off today
                  </span>
                )}
              </td>
              <td className="py-3 text-right tabular-nums">
                {row.purchaseCount}
              </td>
              <td className="py-3 text-right tabular-nums text-muted-foreground">
                {formatMoney(row.averagePaidCents)}
              </td>
              <td className="py-3 text-right tabular-nums">
                {formatMoney(row.grossCents)}
              </td>
              <td className="py-3 text-right font-medium tabular-nums">
                {formatMoney(row.netCents)}
              </td>
              <td className="py-3 text-right tabular-nums">
                <span className="mr-2">{row.sharePercent}%</span>
                <span className="inline-block h-2 w-16 rounded bg-muted align-middle">
                  <span
                    className="block h-2 rounded bg-primary/70"
                    style={{ width: `${row.sharePercent}%` }}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
