import type { Dispatch, SetStateAction } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { QuestionType } from "~/db/schema";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  generateId,
  type WizardOption,
  type WizardState,
} from "~/lib/quiz-wizard";

export type QuizAnswersStepProps = {
  wizard: WizardState;
  setWizard: Dispatch<SetStateAction<WizardState>>;
};

// ─── Step 3: Answers ───
export function QuizAnswersStep({ wizard, setWizard }: QuizAnswersStepProps) {
  function addOption(questionId: string) {
    setWizard((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: [
                ...q.options,
                { id: generateId(), text: "", isCorrect: false },
              ],
            }
          : q
      ),
    }));
  }

  function removeOption(questionId: string, optionId: string) {
    setWizard((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.filter((o) => o.id !== optionId) }
          : q
      ),
    }));
  }

  function updateOption(
    questionId: string,
    optionId: string,
    updates: Partial<WizardOption>
  ) {
    setWizard((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== questionId) return q;
        return {
          ...q,
          options: q.options.map((o) => {
            if (o.id !== optionId) return o;
            return { ...o, ...updates };
          }),
        };
      }),
    }));
  }

  function setCorrectOption(questionId: string, optionId: string) {
    setWizard((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== questionId) return q;
        return {
          ...q,
          options: q.options.map((o) => ({
            ...o,
            isCorrect: o.id === optionId,
          })),
        };
      }),
    }));
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Answer Options</h2>
          <p className="text-sm text-muted-foreground">
            Set answer options for each question and mark the correct answer.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {wizard.questions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Go back and add questions first.
            </p>
          )}

          {wizard.questions.map((q, idx) => (
            <div key={q.id} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-2">
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

              <div className="space-y-2">
                {q.options.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrectOption(q.id, opt.id)}
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        opt.isCorrect
                          ? "border-green-500 bg-green-500 text-white"
                          : "border-muted-foreground/30 hover:border-green-500/50"
                      }`}
                    >
                      {opt.isCorrect && <Check className="size-3" />}
                    </button>
                    {q.type === QuestionType.TrueFalse ? (
                      <span className="text-sm">{opt.text}</span>
                    ) : (
                      <Input
                        value={opt.text}
                        onChange={(event) =>
                          updateOption(q.id, opt.id, {
                            text: event.target.value,
                          })
                        }
                        placeholder="Enter option text..."
                        className="flex-1"
                      />
                    )}
                    {q.type === QuestionType.MultipleChoice &&
                      q.options.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(q.id, opt.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                  </div>
                ))}
              </div>

              {q.type === QuestionType.MultipleChoice && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => addOption(q.id)}
                  className="mt-2"
                >
                  <Plus className="mr-1 size-3" />
                  Add Option
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
