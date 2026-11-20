import type { Dispatch, SetStateAction } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { QuestionType } from "~/db/schema";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  generateId,
  type WizardQuestion,
  type WizardState,
} from "~/lib/quiz-wizard";

export type QuizQuestionsStepProps = {
  wizard: WizardState;
  setWizard: Dispatch<SetStateAction<WizardState>>;
};

// ─── Step 2: Questions ───
export function QuizQuestionsStep({
  wizard,
  setWizard,
}: QuizQuestionsStepProps) {
  function addQuestion() {
    setWizard((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          id: generateId(),
          text: "",
          type: QuestionType.MultipleChoice,
          options: [
            { id: generateId(), text: "", isCorrect: true },
            { id: generateId(), text: "", isCorrect: false },
          ],
        },
      ],
    }));
  }

  function removeQuestion(questionId: string) {
    setWizard((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.id !== questionId),
    }));
  }

  function updateQuestion(
    questionId: string,
    updates: Partial<WizardQuestion>
  ) {
    setWizard((prev) => ({
      ...prev,
      questions: prev.questions.map((q) => {
        if (q.id !== questionId) return q;
        const updated = { ...q, ...updates };
        // When switching to TrueFalse, reset options to True/False
        if (
          updates.type === QuestionType.TrueFalse &&
          q.type !== QuestionType.TrueFalse
        ) {
          updated.options = [
            { id: generateId(), text: "True", isCorrect: true },
            { id: generateId(), text: "False", isCorrect: false },
          ];
        }
        // When switching to MultipleChoice from TrueFalse, add blank options
        if (
          updates.type === QuestionType.MultipleChoice &&
          q.type !== QuestionType.MultipleChoice
        ) {
          updated.options = [
            { id: generateId(), text: "", isCorrect: true },
            { id: generateId(), text: "", isCorrect: false },
          ];
        }
        return updated;
      }),
    }));
  }

  function handleQuestionDragEnd(result: DropResult) {
    if (!result.destination) return;
    const fromIndex = result.source.index;
    const toIndex = result.destination.index;
    if (fromIndex === toIndex) return;

    setWizard((prev) => {
      const reordered = [...prev.questions];
      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(toIndex, 0, moved);
      return { ...prev, questions: reordered };
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Questions</h2>
          <p className="text-sm text-muted-foreground">
            Add questions to your quiz. Drag to reorder. You&apos;ll set answer
            options in the next step.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {wizard.questions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No questions added yet. Click &quot;Add Question&quot; to get
              started.
            </p>
          )}

          <DragDropContext onDragEnd={handleQuestionDragEnd}>
            <Droppable droppableId="quiz-questions" type="question">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="space-y-4"
                >
                  {wizard.questions.map((q, idx) => (
                    <Draggable key={q.id} draggableId={q.id} index={idx}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`flex items-start gap-3 rounded-lg border p-4 ${
                            snapshot.isDragging
                              ? "bg-muted shadow-lg ring-2 ring-primary/20"
                              : ""
                          }`}
                        >
                          <div
                            {...dragProvided.dragHandleProps}
                            className="mt-2 cursor-grab text-muted-foreground hover:text-foreground"
                          >
                            <GripVertical className="size-4" />
                          </div>
                          <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {idx + 1}
                          </span>
                          <div className="flex-1 space-y-3">
                            <Input
                              value={q.text}
                              onChange={(event) =>
                                updateQuestion(q.id, {
                                  text: event.target.value,
                                })
                              }
                              placeholder="Enter question text..."
                            />
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground">
                                Type:
                              </Label>
                              <Select
                                value={q.type}
                                onValueChange={(value) =>
                                  updateQuestion(q.id, {
                                    type: value as QuestionType,
                                  })
                                }
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem
                                    value={QuestionType.MultipleChoice}
                                  >
                                    Multiple Choice
                                  </SelectItem>
                                  <SelectItem value={QuestionType.TrueFalse}>
                                    True / False
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeQuestion(q.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <Button variant="outline" onClick={addQuestion}>
            <Plus className="mr-1.5 size-4" />
            Add Question
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
