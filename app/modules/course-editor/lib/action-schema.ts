import { z } from "zod";
import { CourseStatus } from "~/db/schema";

export const courseEditorActionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("update-title"),
    title: z.string().trim().min(1, "Title cannot be empty."),
  }),
  z.object({
    intent: z.literal("update-description"),
    description: z.string().trim().min(1, "Description cannot be empty."),
  }),
  z.object({
    intent: z.literal("update-status"),
    status: z.nativeEnum(CourseStatus),
  }),
  z.object({ intent: z.literal("update-price"), price: z.string() }),
  z.object({ intent: z.literal("update-ppp-enabled"), pppEnabled: z.string() }),
  z.object({
    intent: z.literal("add-module"),
    title: z.string().trim().min(1, "Module title cannot be empty."),
  }),
  z.object({
    intent: z.literal("rename-module"),
    moduleId: z.coerce.number().int(),
    title: z.string().trim().min(1, "Module title cannot be empty."),
  }),
  z.object({
    intent: z.literal("delete-module"),
    moduleId: z.coerce.number().int(),
  }),
  z.object({
    intent: z.literal("add-lesson"),
    moduleId: z.coerce.number().int(),
    title: z.string().trim().min(1, "Lesson title cannot be empty."),
  }),
  z.object({
    intent: z.literal("rename-lesson"),
    lessonId: z.coerce.number().int(),
    title: z.string().trim().min(1, "Lesson title cannot be empty."),
  }),
  z.object({
    intent: z.literal("reorder-modules"),
    moduleIds: z.string().min(1, "Missing module IDs."),
  }),
  z.object({
    intent: z.literal("reorder-lessons"),
    moduleId: z.coerce.number().int(),
    lessonIds: z.string().min(1, "Missing lesson IDs."),
  }),
  z.object({
    intent: z.literal("move-lesson"),
    lessonId: z.coerce.number().int(),
    targetModuleId: z.coerce.number().int(),
    targetPosition: z.coerce.number().int(),
  }),
  z.object({
    intent: z.literal("delete-lesson"),
    lessonId: z.coerce.number().int(),
  }),
  z.object({
    intent: z.literal("update-sales-copy"),
    salesCopy: z.string().trim().min(1, "Sales copy cannot be empty."),
  }),
]);
