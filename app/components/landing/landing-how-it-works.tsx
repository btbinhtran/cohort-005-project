const STEPS = [
  {
    title: "Pick a course",
    body: "Browse the catalogue by category and find something worth your evenings.",
  },
  {
    title: "Learn lesson by lesson",
    body: "Watch, read and take quizzes in short lessons you can fit around your week.",
  },
  {
    title: "Track your progress",
    body: "Your dashboard picks up where you left off and shows how far you've come.",
  },
];

export function LandingHowItWorks() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Three steps from curious to capable.
        </p>
        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-l-2 border-primary pl-5">
              <p className="text-sm font-semibold text-muted-foreground">
                0{index + 1}
              </p>
              <h3 className="mt-1 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
