import { formatMoney } from "~/lib/analytics";
import type { InstructorAnalytics } from "~/modules/instructor-analytics/index.server";

export function TopBuyers({
  buyers,
}: {
  buyers: InstructorAnalytics["buyers"];
}) {
  if (buyers.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nobody has bought anything in this period, so there is nobody to reach
        out to yet.
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="pb-2 font-medium">Buyer</th>
          <th className="pb-2 font-medium">Seats</th>
          <th className="pb-2 text-right font-medium">Purchases</th>
          <th className="pb-2 text-right font-medium">Total spend</th>
        </tr>
      </thead>
      <tbody>
        {buyers.map((buyer) => (
          <tr key={buyer.userId} className="border-b">
            <td className="py-3">
              <div className="font-medium">{buyer.name}</div>
              <div className="text-xs text-muted-foreground">{buyer.email}</div>
            </td>
            <td className="py-3">
              {buyer.seatsBought > 0 && (
                <div>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium">
                    Team
                  </span>{" "}
                  <span className="text-xs text-muted-foreground">
                    bought {buyer.seatsBought},{" "}
                    {buyer.seatsUnredeemed > 0 ? (
                      // The prompt to chase: seats paid for that nobody is
                      // using are the most actionable thing on this table.
                      <span className="font-medium text-foreground">
                        {buyer.seatsUnredeemed} unused
                      </span>
                    ) : (
                      "all claimed"
                    )}
                  </span>
                </div>
              )}
              {/* Said of team buyers too, not just solo ones: the manager who
                  bought a dozen seats and never opened the course is the very
                  person this table exists to surface. */}
              <div className="text-xs text-muted-foreground">
                {buyer.enrolled ? "Enrolled" : "Never enrolled"}
              </div>
            </td>
            <td className="py-3 text-right tabular-nums">
              {buyer.purchaseCount}
            </td>
            <td className="py-3 text-right font-medium tabular-nums">
              {formatMoney(buyer.spendCents)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
