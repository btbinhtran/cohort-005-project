import { z } from "zod";
import { QuestionType } from "~/db/schema";

export const wizardDataSchema = z.object({
  title: z.string().trim().min(1, "Quiz title is required."),
  passingScore: z.number(),
  questions: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        type: z.nativeEnum(QuestionType),
        options: z.array(
          z.object({
            id: z.string(),
            text: z.string(),
            isCorrect: z.boolean(),
          })
        ),
      })
    )
    .min(1, "At least one question is required."),
});
