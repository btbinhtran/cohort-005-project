import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import type { Route } from "./+types/courses.$slug";
import { coursePermissions } from "~/modules/permissions/course-permissions.server";
import { courseDetail } from "~/modules/course-detail/index.server";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsContentNoShift,
} from "~/components/ui/tabs";
import {
  AlertTriangle,
  BookOpen,
  Clock,
  Pencil,
  PlayCircle,
  ShieldAlert,
  Users,
} from "lucide-react";
import { CourseImage } from "~/components/course-image";
import { UserAvatar } from "~/components/user-avatar";
import { CourseContent } from "~/components/course/course-content";
import { CourseDetailSkeleton } from "~/components/course/course-detail-skeleton";
import { RateCourse } from "~/components/course/rate-course";
import { RequestRefund } from "~/components/course/request-refund";
import { data, isRouteErrorResponse } from "react-router";
import { formatDuration, formatPrice } from "~/lib/utils";
import { resolveCountry } from "~/lib/country.server";
import { calculatePppPrice, countryName, getCountryTierInfo } from "~/lib/ppp";
import { parseFormData } from "~/lib/validation";
import { MAX_RATING, MIN_RATING } from "~/lib/ratings";
import { StarRating } from "~/components/star-rating";

const ratingSchema = z.object({
  rating: z.coerce.number().int().min(MIN_RATING).max(MAX_RATING),
});

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.course?.title ?? "Course";
  return [
    { title: `${title} — Cadence` },
    { name: "description", content: loaderData?.course?.description ?? "" },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  // Public page: signed-out visitors and people without an Enrollment still
  // see it.
  const decisions = await coursePermissions.getCourseDecisions(request, {
    slug: params.slug,
  });
  if (!decisions.found) {
    throw data("Course not found", { status: 404 });
  }

  const page = await courseDetail.loadCoursePage(decisions, new Date());
  if (!page) {
    throw data("Course not found", { status: 404 });
  }

  const country = await resolveCountry(request);
  const pppPrice = page.course.pppEnabled
    ? calculatePppPrice(page.course.price, country)
    : page.course.price;
  const tierInfo = getCountryTierInfo(country);

  return { ...page, pppPrice, tierInfo };
}

// Enrollment is handled via the purchase confirmation page — this action only
// records star ratings.
export async function action({ params, request }: Route.ActionArgs) {
  // Rating needs "take", so a Student under Country Lock can't rate.
  const { person, course } = await coursePermissions.requireCapability(
    request,
    "take",
    { slug: params.slug }
  );

  const formData = await request.formData();
  const parsed = parseFormData(formData, ratingSchema);

  if (!parsed.success) {
    return { ok: false as const, error: "Please choose a rating from 1 to 5." };
  }

  courseDetail.rateCourse({
    userId: person.id,
    courseId: course.id,
    rating: parsed.data.rating,
  });

  return { ok: true as const, error: null };
}

export function HydrateFallback() {
  return <CourseDetailSkeleton />;
}

export default function CourseDetail({ loaderData }: Route.ComponentProps) {
  const {
    course,
    salesCopyHtml,
    lessonCount,
    enrolled,
    canView,
    canTake,
    countryLock,
    progress,
    lessonProgressMap,
    nextLessonId,
    currentUserId,
    pppPrice,
    tierInfo,
    ratingSummary,
    userRating,
    refundOffer,
  } = loaderData;
  const isInstructor = currentUserId === course.instructorId;
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("already_enrolled") === "1") {
      toast.info("You're already enrolled in this course.");
      setSearchParams(
        (prev) => {
          prev.delete("already_enrolled");
          return prev;
        },
        { replace: true }
      );
    }
  }, [searchParams, setSearchParams]);

  const totalDuration = course.modules.reduce(
    (sum, mod) =>
      sum + mod.lessons.reduce((s, l) => s + (l.durationMinutes ?? 0), 0),
    0
  );

  const pppPriceLabel = formatPrice(pppPrice);
  const isDiscounted = pppPrice < course.price;

  const selfPurchaseLink = currentUserId
    ? `/courses/${course.slug}/purchase`
    : `/signup?redirectTo=${encodeURIComponent(`/courses/${course.slug}/purchase`)}`;

  const teamPurchaseLink = currentUserId
    ? `/courses/${course.slug}/purchase?mode=team`
    : `/signup?redirectTo=${encodeURIComponent(`/courses/${course.slug}/purchase?mode=team`)}`;

  const priceDisplay = (
    <div className="mb-3 text-center">
      {isDiscounted ? (
        <>
          <div className="text-sm text-muted-foreground line-through">
            {formatPrice(course.price)}
          </div>
          <div className="text-2xl font-bold">{pppPriceLabel}</div>
          <div className="mt-1 inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300">
            {tierInfo.label} — PPP discount
          </div>
        </>
      ) : (
        <div className="text-2xl font-bold">{pppPriceLabel}</div>
      )}
    </div>
  );

  const enrollButton = (
    <Tabs defaultValue="self">
      <TabsList className="mb-4 w-full">
        <TabsTrigger value="self" className="flex-1 text-xs">
          Buy for Myself
        </TabsTrigger>
        <TabsTrigger value="team" className="flex-1 text-xs">
          Buy for Team
        </TabsTrigger>
      </TabsList>
      <TabsContentNoShift>
        <TabsContent value="self" forceMount>
          {priceDisplay}
          <Link to={selfPurchaseLink}>
            <Button size="lg" className="w-full">
              Enroll Now — {pppPriceLabel}
            </Button>
          </Link>
        </TabsContent>
        <TabsContent value="team" forceMount>
          {priceDisplay}
          <Link to={teamPurchaseLink}>
            <Button size="lg" variant="outline" className="w-full">
              Buy for Your Team
            </Button>
          </Link>
        </TabsContent>
      </TabsContentNoShift>
    </Tabs>
  );

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/courses" className="hover:text-foreground">
          Courses
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{course.title}</span>
      </nav>

      {/* Hero section */}
      <div className="mb-8">
        <div className="mb-6 aspect-video max-h-64 overflow-hidden rounded-lg">
          <CourseImage
            src={course.coverImageUrl}
            alt={course.title}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="mb-2 text-sm font-medium text-primary">
          {course.categoryName}
        </div>
        <div className="mb-3 flex items-start justify-between gap-4">
          <h1 className="text-4xl font-bold">{course.title}</h1>
          {currentUserId === course.instructorId && (
            <Link to={`/instructor/${course.id}`}>
              <Button variant="outline" size="sm" className="shrink-0">
                <Pencil className="mr-1.5 size-3.5" />
                Edit Course
              </Button>
            </Link>
          )}
        </div>
        <StarRating
          average={ratingSummary.average}
          count={ratingSummary.count}
          size="md"
          className="mb-3"
        />
        <p className="mb-4 text-lg text-muted-foreground">
          {course.description}
        </p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <UserAvatar
              name={course.instructorName}
              avatarUrl={course.instructorAvatarUrl}
              className="size-5"
            />
            {course.instructorName}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="size-4" />
            {lessonCount} lessons
          </span>
          {totalDuration > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="size-4" />
              {formatDuration(totalDuration, true, false, false)} total
            </span>
          )}
        </div>
      </div>

      {/* Two-column: sales copy left, sidebar right */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left column: sales copy + course content */}
        <div className="lg:col-span-2">
          <div
            className="prose prose-neutral dark:prose-invert max-w-none"
            // oxlint-disable-next-line react/no-danger -- the instructor wrote this Markdown
            dangerouslySetInnerHTML={{ __html: salesCopyHtml }}
          />

          {/* Bottom CTA */}
          {!enrolled && !isInstructor && (
            <div className="mt-8 rounded-lg border bg-muted/50 p-6">
              <h3 className="mb-2 text-lg font-semibold">
                Ready to get started?
              </h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Join this course and start learning today.
              </p>
              {enrollButton}
            </div>
          )}

          <div className="mt-8">
            <CourseContent
              course={course}
              canView={canView}
              isInstructor={isInstructor}
              lessonProgressMap={lessonProgressMap}
            />
          </div>
        </div>

        {/* Right column: progress/enrollment card */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <h2 className="text-lg font-semibold">
                {isInstructor
                  ? "Your Course"
                  : enrolled
                    ? "Your Progress"
                    : "Get Started"}
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {isInstructor ? (
                <Link to={`/instructor/${course.id}`}>
                  <Button className="w-full">
                    <Pencil className="mr-2 size-4" />
                    Manage Course
                  </Button>
                </Link>
              ) : enrolled ? (
                <>
                  {countryLock && (
                    <div className="flex gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
                      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
                      <p>
                        You bought this course at a Purchasing-Power Price in{" "}
                        <strong>
                          {countryName(countryLock.purchaseCountry)}
                        </strong>
                        , so it can&apos;t be used from{" "}
                        <strong>
                          {countryName(countryLock.currentCountry)}
                        </strong>
                        .
                      </p>
                    </div>
                  )}
                  {canTake && (
                    <>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span>{progress}% complete</span>
                      </div>
                      <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      {course.modules.length > 0 &&
                        (() => {
                          const targetLessonId =
                            nextLessonId ?? course.modules[0].lessons[0]?.id;
                          return targetLessonId ? (
                            <Link
                              to={`/courses/${course.slug}/lessons/${targetLessonId}`}
                            >
                              <Button className="w-full">
                                <PlayCircle className="mr-2 size-4" />
                                {progress > 0
                                  ? "Continue Learning"
                                  : "Start Course"}
                              </Button>
                            </Link>
                          ) : null;
                        })()}
                    </>
                  )}
                  <Link to={teamPurchaseLink}>
                    <Button variant="outline" className="w-full">
                      <Users className="mr-2 size-4" />
                      Buy More Seats
                    </Button>
                  </Link>
                  {canTake && <RateCourse userRating={userRating} />}
                  {refundOffer && (
                    <RequestRefund
                      slug={course.slug}
                      purchaseId={refundOffer.purchaseId}
                      amount={refundOffer.amount}
                    />
                  )}
                </>
              ) : (
                enrollButton
              )}
              <div className="space-y-2 pt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <BookOpen className="size-4" />
                  <span>{lessonCount} lessons</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="size-4" />
                  <span>
                    {formatDuration(totalDuration, true, false, false)} total
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <UserAvatar
                    name={course.instructorName}
                    avatarUrl={course.instructorAvatarUrl}
                    className="size-5"
                  />
                  <span>Taught by {course.instructorName}</span>
                </div>
                {course.instructorBio && (
                  <p className="mt-2 text-xs leading-relaxed">
                    {course.instructorBio}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred while loading this course.";

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
          <Link to="/courses">
            <Button variant="outline">Browse Courses</Button>
          </Link>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
