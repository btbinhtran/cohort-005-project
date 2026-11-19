import { Link } from "react-router";
import { PLATFORM_FEE_PERCENT, formatMoney } from "~/lib/analytics";
import type { InstructorAnalytics } from "~/modules/instructor-analytics/index.server";
import { REFUND_WINDOW_DAYS } from "~/lib/refund-rules";
import { Card, CardContent } from "~/components/ui/card";
import { RefundExposurePanel } from "./refund-exposure-panel";
import { RevenueChart } from "./revenue-chart";
import { MoneyCard, StatCard } from "./stat-cards";
import { TopBuyers } from "./top-buyers";

type OverviewTabProps = Pick<
  InstructorAnalytics,
  | "summary"
  | "series"
  | "audience"
  | "buyers"
  | "questions"
  | "ratings"
  | "refundExposure"
>;

/** The overview tab: money, audience, the revenue chart and who is buying. */
export function OverviewTab({
  summary,
  series,
  audience,
  buyers,
  questions,
  ratings,
  refundExposure,
}: OverviewTabProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <MoneyCard
          label="Gross revenue"
          amountCents={summary.grossCents}
          hint={`What students paid, across ${summary.purchaseCount} ${
            summary.purchaseCount === 1 ? "purchase" : "purchases"
          }.`}
        />
        <MoneyCard
          label={`Platform fee (${PLATFORM_FEE_PERCENT}%)`}
          amountCents={summary.feeCents}
          hint="Cadence's cut. Already deducted from your earnings."
        />
        <MoneyCard
          label="Your net earnings"
          amountCents={summary.netCents}
          hint="What you keep — gross revenue minus the platform fee."
          emphasis
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Buyers"
          value={audience.buyerCount}
          hint="People who paid. A team buying several seats counts once."
          emptyHint="Nobody has bought in this period."
        />
        <StatCard
          label="Enrolled students"
          value={audience.studentCount}
          hint={`Students with access, seats included.${
            audience.revenuePerStudentCents === null
              ? ""
              : ` ${formatMoney(
                  audience.revenuePerStudentCents
                )} of revenue each.`
          }`}
          emptyHint="Nobody has enrolled in this period."
        />
        <StatCard
          label="Unanswered questions"
          value={questions.inRange}
          hint={
            questions.older > 0
              ? `Plus ${questions.older} from before this period.`
              : "Students waiting on a reply."
          }
          // Quiet this period is only good news if the backlog is empty
          // too, so the older count keeps its place in the empty copy.
          emptyHint={
            questions.older > 0
              ? `None this period, but ${questions.older} still waiting from before.`
              : "Nothing is waiting on you."
          }
          action={
            questions.inRange + questions.older > 0 ? (
              <Link
                to="/instructor/questions"
                className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
              >
                Answer them
              </Link>
            ) : null
          }
        />
        <StatCard
          label="Course rating"
          value={ratings.average === null ? "—" : `${ratings.average} ★`}
          hint={`Across ${ratings.count} ${
            ratings.count === 1 ? "rating" : "ratings"
          }.`}
          emptyHint="Nobody has rated your courses in this period."
        />
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Revenue over time</h2>
          {/* Keyed on the sales themselves, not on the points: a fixed
            range always spans its whole window, so an instructor with
            no sales would otherwise get a flat line along zero rather
            than being told there is nothing there. */}
          {summary.purchaseCount === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No sales in this period yet.
            </p>
          ) : (
            <RevenueChart series={series} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Top buyers</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Your ten biggest spenders in this period — the people worth reaching
            out to.
          </p>
          <TopBuyers buyers={buyers} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Refund exposure</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Revenue in this period that is still inside its {REFUND_WINDOW_DAYS}
            -day refund window, so it could still go back out.
          </p>
          <RefundExposurePanel exposure={refundExposure} />
        </CardContent>
      </Card>
    </>
  );
}
