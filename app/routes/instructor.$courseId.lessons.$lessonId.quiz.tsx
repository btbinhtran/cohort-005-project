import { useState } from "react";
import { Link, useFetcher, useNavigate } from "react-router";
import { toast } from "sonner";
import type { Route } from "./+types/instructor.$courseId.lessons.$lessonId.quiz";
import { coursePermissions } from "~/modules/permissions/course-permissions.server";
import {
  quizBuilder,
  wizardDataSchema,
} from "~/modules/quiz-builder/index.server";
import { QuestionType } from "~/db/schema";
import { Button } from "~/components/ui/button";
import { ArrowLeft, ArrowRight, Trash2, AlertTriangle } from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";
import { z } from "zod";
import { parseFormData, parseParams, recordId } from "~/lib/validation";
import { generateId, type WizardState } from "~/lib/quiz-wizard";
import { StepIndicator } from "~/components/quiz-step-indicator";
import { QuizSettingsStep } from "~/components/quiz-settings-step";
import { QuizQuestionsStep } from "~/components/quiz-questions-step";
import { QuizAnswersStep } from "~/components/quiz-answers-step";
import { QuizReviewStep } from "~/components/quiz-review-step";

const lessonParamsSchema = z.object({ lessonId: recordId });

const quizActionSchema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("save-quiz"),
    wizardData: z.string(),
  }),
  z.object({
    intent: z.literal("delete-quiz"),
  }),
]);

// ─── Meta ───

export function meta({ loaderData }: Route.MetaArgs) {
  const lessonTitle = loaderData?.lesson?.title ?? "Lesson";
  const hasQuiz = !!loaderData?.existingQuiz;
  return [
    {
      title: `${hasQuiz ? "Edit" : "Create"} Quiz: ${lessonTitle} — Cadence`,
    },
  ];
}

// ─── Loader ───

export async function loader({ params, request }: Route.LoaderArgs) {
  const { course } = await coursePermissions.requireCapability(
    request,
    "manage",
    { courseId: params.courseId, lessonId: params.lessonId }
  );
  // requireCapability has checked this is a lesson in the course.
  const lesson = quizBuilder.getLessonById(
    parseParams(params, lessonParamsSchema).lessonId
  );
  const mod = lesson && quizBuilder.getModuleById(lesson.moduleId);
  if (!lesson || !mod) {
    throw data("Lesson not found.", { status: 404 });
  }
  const lessonId = lesson.id;

  // Load existing quiz if present
  const existingQuizBasic = quizBuilder.getQuizByLessonId(lessonId);
  const existingQuiz = existingQuizBasic
    ? quizBuilder.getQuizWithQuestions(existingQuizBasic.id)
    : null;

  return { course, lesson, module: mod, existingQuiz };
}

// ─── Action ───

export async function action({ params, request }: Route.ActionArgs) {
  await coursePermissions.requireCapability(request, "manage", {
    courseId: params.courseId,
    lessonId: params.lessonId,
  });
  // requireCapability has checked this is a lesson in the course.
  const { lessonId } = parseParams(params, lessonParamsSchema);

  const formData = await request.formData();
  const parsed = parseFormData(formData, quizActionSchema);

  if (!parsed.success) {
    return data(
      { error: Object.values(parsed.errors)[0] ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { intent } = parsed.data;

  if (intent === "save-quiz") {
    let wizardData: z.infer<typeof wizardDataSchema>;
    try {
      const raw = JSON.parse(parsed.data.wizardData);
      const wizardResult = wizardDataSchema.safeParse(raw);
      if (!wizardResult.success) {
        return data({ error: "Invalid quiz data." }, { status: 400 });
      }
      wizardData = wizardResult.data;
    } catch {
      return data({ error: "Invalid quiz data." }, { status: 400 });
    }

    // Delete existing quiz if present
    const existingQuiz = quizBuilder.getQuizByLessonId(lessonId);
    if (existingQuiz) {
      quizBuilder.deleteQuiz(existingQuiz.id);
    }

    // Create the quiz
    const quiz = quizBuilder.createQuiz(
      lessonId,
      wizardData.title.trim(),
      wizardData.passingScore / 100
    );

    // Create questions and options
    for (let qi = 0; qi < wizardData.questions.length; qi++) {
      const q = wizardData.questions[qi];
      const question = quizBuilder.createQuestion(
        quiz.id,
        q.text.trim(),
        q.type,
        qi + 1
      );

      for (const opt of q.options) {
        quizBuilder.createOption(question.id, opt.text.trim(), opt.isCorrect);
      }
    }

    return { success: true };
  }

  if (intent === "delete-quiz") {
    const existingQuiz = quizBuilder.getQuizByLessonId(lessonId);
    if (existingQuiz) {
      quizBuilder.deleteQuiz(existingQuiz.id);
    }
    return { success: true, deleted: true };
  }

  throw data("Invalid action.", { status: 400 });
}

// ─── Component ───

export default function QuizBuilderWizard({
  loaderData,
}: Route.ComponentProps) {
  const { course, lesson, existingQuiz } = loaderData;
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Initialize wizard state from existing quiz or defaults
  const [wizard, setWizard] = useState<WizardState>(() => {
    if (existingQuiz) {
      return {
        title: existingQuiz.title,
        passingScore: Math.round(existingQuiz.passingScore * 100),
        questions: existingQuiz.questions.map((q) => ({
          id: generateId(),
          text: q.questionText,
          type: q.questionType as QuestionType,
          options: q.options.map((o) => ({
            id: generateId(),
            text: o.optionText,
            isCorrect: o.isCorrect,
          })),
        })),
      };
    }
    return {
      title: "",
      passingScore: 70,
      questions: [],
    };
  });

  const isEditing = !!existingQuiz;

  // Toast on success
  const fetcherData = fetcher.data as
    | { success?: boolean; deleted?: boolean; error?: string }
    | undefined;

  if (fetcher.state === "idle" && fetcherData?.success) {
    if (fetcherData.deleted) {
      toast.success("Quiz deleted.");
      navigate(`/instructor/${course.id}/lessons/${lesson.id}`);
    } else {
      toast.success("Quiz saved.");
      navigate(`/instructor/${course.id}/lessons/${lesson.id}`);
    }
  }

  // ─── Navigation ───
  function canGoNext() {
    if (step === 1) return wizard.title.trim().length > 0;
    if (step === 2) return wizard.questions.length > 0;
    if (step === 3) return true;
    return false;
  }

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/instructor" className="hover:text-foreground">
          My Courses
        </Link>
        <span className="mx-2">/</span>
        <Link to={`/instructor/${course.id}`} className="hover:text-foreground">
          {course.title}
        </Link>
        <span className="mx-2">/</span>
        <Link
          to={`/instructor/${course.id}/lessons/${lesson.id}`}
          className="hover:text-foreground"
        >
          {lesson.title}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">
          {isEditing ? "Edit Quiz" : "Create Quiz"}
        </span>
      </nav>

      <Link
        to={`/instructor/${course.id}/lessons/${lesson.id}`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 size-4" />
        Back to Lesson Editor
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isEditing ? "Edit Quiz" : "Create Quiz"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lesson: {lesson.title}
          </p>
        </div>
        {isEditing && (
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (
                confirm(
                  "Are you sure you want to delete this quiz? All student attempts will be lost."
                )
              ) {
                fetcher.submit({ intent: "delete-quiz" }, { method: "post" });
              }
            }}
          >
            <Trash2 className="mr-1.5 size-4" />
            Delete Quiz
          </Button>
        )}
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={step} onStepClick={setStep} />

      {/* Step content */}
      {step === 1 && <QuizSettingsStep wizard={wizard} setWizard={setWizard} />}
      {step === 2 && (
        <QuizQuestionsStep wizard={wizard} setWizard={setWizard} />
      )}
      {step === 3 && <QuizAnswersStep wizard={wizard} setWizard={setWizard} />}
      {step === 4 && (
        <QuizReviewStep
          wizard={wizard}
          isEditing={isEditing}
          fetcher={fetcher}
          fetcherData={fetcherData}
        />
      )}

      {/* Step navigation */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
        >
          <ArrowLeft className="mr-1.5 size-4" />
          Previous
        </Button>
        {step < 4 && (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canGoNext()}>
            Next
            <ArrowRight className="ml-1.5 size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading the quiz builder.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Not found";
      message = "The quiz, lesson, or course you're looking for doesn't exist.";
    } else if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Not allowed";
      message =
        typeof error.data === "string"
          ? error.data
          : "You aren't allowed to see this page.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/instructor">
            <Button variant="outline">My Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
