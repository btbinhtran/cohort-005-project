import type { LucideIcon } from "lucide-react";
import { BookOpen, GraduationCap, Layers, PlayCircle } from "lucide-react";
import type { CatalogueStats } from "~/modules/landing-page/index.server";

export function LandingStats({ stats }: { stats: CatalogueStats }) {
  const tiles: { icon: LucideIcon; value: number; label: string }[] = [
    { icon: BookOpen, value: stats.courses, label: "Published courses" },
    { icon: PlayCircle, value: stats.lessons, label: "Lessons" },
    { icon: GraduationCap, value: stats.instructors, label: "Instructors" },
    { icon: Layers, value: stats.categories, label: "Categories" },
  ];

  return (
    <section className="border-y border-border bg-muted/50">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-12 lg:grid-cols-4">
        {tiles.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="size-6 text-primary" />
            </div>
            <div>
              <dd className="text-2xl font-bold">{value}</dd>
              <dt className="text-sm text-muted-foreground">{label}</dt>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
