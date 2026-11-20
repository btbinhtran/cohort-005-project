import { CheckCircle2, Circle } from "lucide-react";

const STEPS = [
  { label: "Settings", number: 1 },
  { label: "Questions", number: 2 },
  { label: "Answers", number: 3 },
  { label: "Review", number: 4 },
];

export function StepIndicator({
  currentStep,
  onStepClick,
}: {
  currentStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {STEPS.map((step, i) => (
        <div key={step.number} className="flex items-center">
          <button
            type="button"
            onClick={() => onStepClick(step.number)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              step.number === currentStep
                ? "bg-primary text-primary-foreground"
                : step.number < currentStep
                  ? "bg-primary/20 text-primary hover:bg-primary/30"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {step.number < currentStep ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <Circle className="size-4" />
            )}
            {step.label}
          </button>
          {i < STEPS.length - 1 && <div className="mx-2 h-px w-8 bg-border" />}
        </div>
      ))}
    </div>
  );
}
