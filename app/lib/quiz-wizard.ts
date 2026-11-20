import type { QuestionType } from "~/db/schema";

// ─── Types for wizard state ───

export type WizardOption = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type WizardQuestion = {
  id: string;
  text: string;
  type: QuestionType;
  options: WizardOption[];
};

export type WizardState = {
  title: string;
  passingScore: number;
  questions: WizardQuestion[];
};

export function generateId() {
  return Math.random().toString(36).slice(2, 10);
}
