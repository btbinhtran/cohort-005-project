import { useState, useEffect } from "react";
import { Link, useFetcher } from "react-router";
import { toast } from "sonner";
import type { Route } from "./+types/instructor.$courseId";
import { coursePermissions } from "~/modules/permissions/course-permissions.server";
import {
  courseEditor,
  courseEditorActionSchema,
} from "~/modules/course-editor/index.server";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  InlineEditableDescription,
  InlineEditableTitle,
} from "~/components/course-editor-header-fields";
import { AddModuleForm } from "~/components/course-editor-module-controls";
import { CourseOutline } from "~/components/course-outline";
import { CourseSettingsPanel } from "~/components/course-settings-panel";
import { CourseSalesCopyPanel } from "~/components/course-sales-copy-panel";
import { CourseStudentsTable } from "~/components/course-students-table";
import {
  ArrowLeft,
  BookOpen,
  Settings,
  Users,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { data, isRouteErrorResponse } from "react-router";
import { parseFormData } from "~/lib/validation";

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Edit Course";
  return [
    { title: `Edit: ${title} — Cadence` },
    { name: "description", content: `Edit course: ${title}` },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const {
    course: { id: courseId },
  } = await coursePermissions.requireCapability(request, "manage", {
    courseId: params.courseId,
  });

  const course = courseEditor.getCourseWithDetails(courseId);
  if (!course) {
    throw data("Course not found.", { status: 404 });
  }

  const lessonCount = courseEditor.getLessonCountForCourse(courseId);
  const enrollmentCount = courseEditor.getEnrollmentCountForCourse(courseId);

  const { students, quizCount } = courseEditor.getStudentRoster(
    courseId,
    course.modules.flatMap((mod) => mod.lessons)
  );

  return { course, lessonCount, enrollmentCount, students, quizCount };
}

export async function action({ params, request }: Route.ActionArgs) {
  const { course } = await coursePermissions.requireCapability(
    request,
    "manage",
    { courseId: params.courseId }
  );
  const courseId = course.id;

  const formData = await request.formData();
  const parsed = parseFormData(formData, courseEditorActionSchema);

  if (!parsed.success) {
    return data(
      { error: Object.values(parsed.errors)[0] ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { intent } = parsed.data;

  if (intent === "update-title") {
    courseEditor.updateCourse(courseId, parsed.data.title, course.description);
    return { success: true, field: "title" };
  }

  if (intent === "update-description") {
    courseEditor.updateCourse(courseId, course.title, parsed.data.description);
    return { success: true, field: "description" };
  }

  if (intent === "update-status") {
    courseEditor.updateCourseStatus(courseId, parsed.data.status);
    return { success: true, field: "status" };
  }

  if (intent === "update-price") {
    const priceDollars = parseFloat(parsed.data.price);
    if (isNaN(priceDollars) || priceDollars < 0) {
      return data(
        { error: "Price must be a non-negative number." },
        { status: 400 }
      );
    }
    if (priceDollars > 9999.99) {
      return data({ error: "Price cannot exceed $9,999.99." }, { status: 400 });
    }
    const priceCents = Math.round(priceDollars * 100);
    courseEditor.updateCoursePrice(courseId, priceCents);
    return { success: true, field: "price" };
  }

  if (intent === "update-ppp-enabled") {
    const pppEnabled = parsed.data.pppEnabled === "true";
    courseEditor.updateCoursePppEnabled(courseId, pppEnabled);
    return { success: true, field: "ppp-enabled" };
  }

  if (intent === "add-module") {
    courseEditor.createModule(courseId, parsed.data.title, null);
    return { success: true, field: "module" };
  }

  if (intent === "rename-module") {
    const { moduleId, title } = parsed.data;
    const mod = courseEditor.getModuleById(moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Module not found in this course." },
        { status: 404 }
      );
    }
    courseEditor.updateModuleTitle(moduleId, title);
    return { success: true, field: "module" };
  }

  if (intent === "delete-module") {
    const { moduleId } = parsed.data;
    const mod = courseEditor.getModuleById(moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Module not found in this course." },
        { status: 404 }
      );
    }
    courseEditor.deleteModule(moduleId);
    return { success: true, field: "module" };
  }

  if (intent === "add-lesson") {
    const { moduleId, title } = parsed.data;
    const mod = courseEditor.getModuleById(moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Module not found in this course." },
        { status: 404 }
      );
    }
    courseEditor.createLesson(moduleId, title, null, null, null, null);
    return { success: true, field: "lesson" };
  }

  if (intent === "rename-lesson") {
    const { lessonId, title } = parsed.data;
    const lesson = courseEditor.getLessonById(lessonId);
    if (!lesson) {
      return data({ error: "Lesson not found." }, { status: 404 });
    }
    const mod = courseEditor.getModuleById(lesson.moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Lesson not found in this course." },
        { status: 404 }
      );
    }
    courseEditor.updateLessonTitle(lessonId, title);
    return { success: true, field: "lesson" };
  }

  if (intent === "reorder-modules") {
    const moduleIds: number[] = JSON.parse(parsed.data.moduleIds);
    courseEditor.reorderModules(courseId, moduleIds);
    return { success: true, field: "module-reorder" };
  }

  if (intent === "reorder-lessons") {
    const { moduleId, lessonIds: lessonIdsJson } = parsed.data;
    const mod = courseEditor.getModuleById(moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Module not found in this course." },
        { status: 404 }
      );
    }
    const lessonIds: number[] = JSON.parse(lessonIdsJson);
    courseEditor.reorderLessons(moduleId, lessonIds);
    return { success: true, field: "lesson-reorder" };
  }

  if (intent === "move-lesson") {
    const { lessonId, targetModuleId, targetPosition } = parsed.data;
    const lesson = courseEditor.getLessonById(lessonId);
    if (!lesson) {
      return data({ error: "Lesson not found." }, { status: 404 });
    }
    const sourceMod = courseEditor.getModuleById(lesson.moduleId);
    if (!sourceMod || sourceMod.courseId !== courseId) {
      return data(
        { error: "Lesson not found in this course." },
        { status: 404 }
      );
    }
    const targetMod = courseEditor.getModuleById(targetModuleId);
    if (!targetMod || targetMod.courseId !== courseId) {
      return data(
        { error: "Target module not found in this course." },
        { status: 404 }
      );
    }
    courseEditor.moveLessonToModule(lessonId, targetModuleId, targetPosition);
    return { success: true, field: "lesson-move" };
  }

  if (intent === "delete-lesson") {
    const { lessonId } = parsed.data;
    const lesson = courseEditor.getLessonById(lessonId);
    if (!lesson) {
      return data({ error: "Lesson not found." }, { status: 404 });
    }
    const mod = courseEditor.getModuleById(lesson.moduleId);
    if (!mod || mod.courseId !== courseId) {
      return data(
        { error: "Lesson not found in this course." },
        { status: 404 }
      );
    }
    courseEditor.deleteLesson(lessonId);
    return { success: true, field: "lesson" };
  }

  if (intent === "update-sales-copy") {
    courseEditor.updateCourseSalesCopy(courseId, parsed.data.salesCopy);
    return { success: true, field: "sales-copy" };
  }

  throw data("Invalid action.", { status: 400 });
}

export default function InstructorCourseEditor({
  loaderData,
}: Route.ComponentProps) {
  const { course, lessonCount, enrollmentCount, students, quizCount } =
    loaderData;
  const statusFetcher = useFetcher();
  const reorderFetcher = useFetcher();
  const lessonReorderFetcher = useFetcher();
  const salesCopyFetcher = useFetcher();
  const priceFetcher = useFetcher();
  const pppFetcher = useFetcher();

  const [salesCopy, setSalesCopy] = useState<string>(course.salesCopy);
  const salesCopyHasChanges = salesCopy !== course.salesCopy;
  const salesCopyIsEmpty = salesCopy.trim().length === 0;

  useEffect(() => {
    if (statusFetcher.state === "idle" && statusFetcher.data?.success) {
      toast.success("Course status updated.");
    }
    if (statusFetcher.state === "idle" && statusFetcher.data?.error) {
      toast.error(statusFetcher.data.error);
    }
  }, [statusFetcher.state, statusFetcher.data]);

  useEffect(() => {
    if (reorderFetcher.state === "idle" && reorderFetcher.data?.success) {
      toast.success("Modules reordered.");
    }
    if (reorderFetcher.state === "idle" && reorderFetcher.data?.error) {
      toast.error(reorderFetcher.data.error);
    }
  }, [reorderFetcher.state, reorderFetcher.data]);

  useEffect(() => {
    if (
      lessonReorderFetcher.state === "idle" &&
      lessonReorderFetcher.data?.success
    ) {
      toast.success("Lessons reordered.");
    }
    if (
      lessonReorderFetcher.state === "idle" &&
      lessonReorderFetcher.data?.error
    ) {
      toast.error(lessonReorderFetcher.data.error);
    }
  }, [lessonReorderFetcher.state, lessonReorderFetcher.data]);

  useEffect(() => {
    if (salesCopyFetcher.state === "idle" && salesCopyFetcher.data?.success) {
      toast.success("Sales copy saved.");
    }
    if (salesCopyFetcher.state === "idle" && salesCopyFetcher.data?.error) {
      toast.error(salesCopyFetcher.data.error);
    }
  }, [salesCopyFetcher.state, salesCopyFetcher.data]);

  useEffect(() => {
    if (priceFetcher.state === "idle" && priceFetcher.data?.success) {
      toast.success("Price updated.");
    }
    if (priceFetcher.state === "idle" && priceFetcher.data?.error) {
      toast.error(priceFetcher.data.error);
    }
  }, [priceFetcher.state, priceFetcher.data]);

  useEffect(() => {
    if (pppFetcher.state === "idle" && pppFetcher.data?.success) {
      toast.success("PPP setting updated.");
    }
    if (pppFetcher.state === "idle" && pppFetcher.data?.error) {
      toast.error(pppFetcher.data.error);
    }
  }, [pppFetcher.state, pppFetcher.data]);

  function handleSalesCopySave() {
    salesCopyFetcher.submit(
      { intent: "update-sales-copy", salesCopy },
      { method: "post" }
    );
  }

  function handleStatusChange(newStatus: string) {
    statusFetcher.submit(
      { intent: "update-status", status: newStatus },
      { method: "post" }
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/instructor" className="hover:text-foreground">
          My Courses
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{course.title}</span>
      </nav>

      <Link
        to="/instructor"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 size-4" />
        Back to My Courses
      </Link>

      {/* Course Header with inline editing */}
      <div className="mb-8">
        <InlineEditableTitle value={course.title} courseId={course.id} />
        <div className="mt-2">
          <InlineEditableDescription
            value={course.description}
            courseId={course.id}
          />
        </div>

        {/* Stats row */}
        <div className="mt-4 flex flex-wrap items-center gap-4 px-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <BookOpen className="size-4" />
            {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="size-4" />
            {enrollmentCount} {enrollmentCount === 1 ? "student" : "students"}
          </span>
          <span className="text-xs text-muted-foreground">
            Slug: /courses/{course.slug}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">
            <BookOpen className="size-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="size-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="sales-copy">
            <FileText className="size-4" />
            Sales Copy
          </TabsTrigger>
          <TabsTrigger value="students">
            <Users className="size-4" />
            Students
          </TabsTrigger>
        </TabsList>

        {/* Content Tab */}
        <TabsContent value="content" className="mt-6">
          {course.modules.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  No modules yet. Add your first module to start building
                  content.
                </p>
              </CardContent>
            </Card>
          ) : (
            <CourseOutline
              course={course}
              reorderFetcher={reorderFetcher}
              lessonReorderFetcher={lessonReorderFetcher}
            />
          )}
          <AddModuleForm />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6">
          <CourseSettingsPanel
            course={course}
            handleStatusChange={handleStatusChange}
            priceFetcher={priceFetcher}
            pppFetcher={pppFetcher}
          />
        </TabsContent>

        {/* Sales Copy Tab */}
        <TabsContent value="sales-copy" className="mt-6">
          <CourseSalesCopyPanel
            salesCopy={salesCopy}
            setSalesCopy={setSalesCopy}
            handleSalesCopySave={handleSalesCopySave}
            salesCopyHasChanges={salesCopyHasChanges}
            salesCopyIsEmpty={salesCopyIsEmpty}
            salesCopyFetcher={salesCopyFetcher}
          />
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="mt-6">
          <CourseStudentsTable students={students} quizCount={quizCount} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading the course editor.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Course not found";
      message =
        "The course you're looking for doesn't exist or may have been removed.";
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
          : "You don't have permission to edit this course.";
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
