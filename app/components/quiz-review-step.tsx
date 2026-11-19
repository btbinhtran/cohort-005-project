import type { useFetcher } from "react-router";
import { CheckCircle2, Save, XCircle } from "lucide-react";
import { QuestionType } from "~/db/schema";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import type { WizardState } from "~/lib/quiz-wizard";

export type QuizReviewStepProps = {
  wizard: WizardState;
  isEditing: boolean;
  // The fetcher belongs to the page, which navigates away once it succeeds.
  fetcher: ReturnType<typeof useFetcher>;
  fetcherData: { error?: string } | undefined;
};

// ─── Step 4: Review ───
export function QuizReviewStep({
  wizard,
  isEditing,
  fetcher,
  fetcherData,
}: QuizReviewStepProps) {
  const validationErrors: string[] = [];
  if (!wizard.title.trim()) validationErrors.push("Quiz title is required.");
  if (wizard.questions.length === 0)
    validationErrors.push("At least one question is required.");
  for (const q of wizard.questions) {
    if (!q.text.trim())
      validationErrors.push(
        `Question ${wizard.questions.indexOf(q) + 1} has no text.`
      );
    if (q.options.length < 2)
      validationErrors.push(
        `Question ${wizard.questions.indexOf(q) + 1} needs at least 2 options.`
      );
    if (!q.options.some((o) => o.isCorrect))
      validationErrors.push(
        `Question ${wizard.questions.indexOf(q) + 1} has no correct answer.`
      );
    for (const opt of q.options) {
      if (!opt.text.trim())
        validationErrors.push(
          `Question ${wizard.questions.indexOf(q) + 1} has an empty option.`
        );
    }
  }

  const isValid = validationErrors.length === 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Review Quiz</h2>
          <p className="text-sm text-muted-foreground">
            Review your quiz before saving.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quiz summary */}
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">Title:</span>{" "}
                {wizard.title || "(empty)"}
              </div>
              <div>
                <span className="font-medium">Passing Score:</span>{" "}
                {wizard.passingScore}%
              </div>
              <div>
                <span className="font-medium">Questions:</span>{" "}
                {wizard.questions.length}
              </div>
            </div>
          </div>

          {/* Questions review */}
          {wizard.questions.map((q, idx) => (
            <div key={q.id} className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {idx + 1}
                </span>
                <span className="font-medium">
                  {q.text || "(No question text)"}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {q.type === QuestionType.TrueFalse
                    ? "True/False"
                    : "Multiple Choice"}
                </span>
              </div>
              <div className="ml-8 space-y-1">
                {q.options.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-2 text-sm">
                    {opt.isCorrect ? (
                      <CheckCircle2 className="size-4 text-green-500" />
                    ) : (
                      <XCircle className="size-4 text-muted-foreground/40" />
                    )}
                    <span
                      className={
                        opt.isCorrect ? "font-medium text-green-700" : ""
                      }
                    >
                      {opt.text || "(empty)"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="mb-2 text-sm font-medium text-destructive">
                Please fix these issues before saving:
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-destructive">
                {validationErrors.map((error, i) => (
                  // oxlint-disable-next-line react/no-array-index-key -- messages can repeat, and the list is rebuilt on every render
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Save button */}
          <div className="flex items-center gap-3">
            <Button
              disabled={!isValid || fetcher.state !== "idle"}
              onClick={() => {
                fetcher.submit(
                  {
                    intent: "save-quiz",
                    wizardData: JSON.stringify(wizard),
                  },
                  { method: "post" }
                );
              }}
            >
              <Save className="mr-1.5 size-4" />
              {fetcher.state !== "idle"
                ? "Saving..."
                : isEditing
                  ? "Update Quiz"
                  : "Create Quiz"}
            </Button>

            {fetcherData?.error && (
              <span className="text-sm text-destructive">
                {fetcherData.error}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
