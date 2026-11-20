import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatBucket, formatMoney } from "~/lib/analytics";
import type { RevenueSeries } from "~/modules/instructor-analytics/index.server";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "~/components/ui/chart";

const chartConfig = {
  grossCents: { label: "Gross revenue", color: "var(--chart-1)" },
  netCents: { label: "Net earnings", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function RevenueChart({ series }: { series: RevenueSeries }) {
  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <AreaChart data={series.points} margin={{ left: 12, right: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={formatBucket}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={72}
          tickFormatter={(cents: number) => formatMoney(cents)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) => formatBucket(String(label))}
              formatter={(value, name) => (
                <span className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">
                    {chartConfig[name as keyof typeof chartConfig]?.label ??
                      name}
                  </span>
                  <span className="font-mono font-medium">
                    {formatMoney(Number(value))}
                  </span>
                </span>
              )}
            />
          }
        />
        <Area
          dataKey="grossCents"
          type="monotone"
          stroke="var(--color-grossCents)"
          fill="var(--color-grossCents)"
          fillOpacity={0.2}
        />
        <Area
          dataKey="netCents"
          type="monotone"
          stroke="var(--color-netCents)"
          fill="var(--color-netCents)"
          fillOpacity={0.2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
