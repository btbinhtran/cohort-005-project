import { formatMoney } from "~/lib/analytics";
import { Card, CardContent } from "~/components/ui/card";

export function MoneyCard({
  label,
  amountCents,
  hint,
  emphasis,
}: {
  label: string;
  amountCents: number;
  hint: string;
  emphasis?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <div
          className={
            emphasis
              ? "mt-2 text-3xl font-bold text-primary"
              : "mt-2 text-3xl font-bold"
          }
        >
          {formatMoney(amountCents)}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/**
 * A single figure with its own empty copy.
 *
 * Every panel says what it means when it has nothing, so an instructor can
 * tell "nothing has happened yet" from "this is broken".
 */
export function StatCard({
  label,
  value,
  hint,
  emptyHint,
  action,
}: {
  label: string;
  value: string | number;
  hint: string;
  /** Shown instead of `hint` when the figure is zero — and greys the figure. */
  emptyHint?: string;
  action?: React.ReactNode;
}) {
  const empty = emptyHint !== undefined && (value === 0 || value === "—");

  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
        <div
          className={
            empty
              ? "mt-2 text-3xl font-bold text-muted-foreground"
              : "mt-2 text-3xl font-bold"
          }
        >
          {value}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {empty ? emptyHint : hint}
        </p>
        {action}
      </CardContent>
    </Card>
  );
}
