import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { CourseImage } from "~/components/course-image";
import type { FeaturedCourse } from "~/modules/landing-page/index.server";

const COVER_POSITIONS = [
  "left-0 top-20 z-30 -rotate-2",
  "left-20 top-10 z-20 rotate-2",
  "left-40 top-0 z-10 rotate-6",
];

export function LandingHero({
  signedIn,
  covers,
}: {
  signedIn: boolean;
  covers: FeaturedCourse[];
}) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-16 px-6 py-20 lg:grid-cols-2 lg:py-28">
      <div>
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Courses for developers
        </p>
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Learn to code,
          <br />
          <span className="text-muted-foreground">at your own pace</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Structured courses built by experienced instructors. Track your
          progress, take quizzes, and build real-world skills.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Button asChild size="lg">
            <Link to="/courses">
              Browse Courses
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            {signedIn ? (
              <Link to="/dashboard">Go to Dashboard</Link>
            ) : (
              <Link to="/signup">Create a free account</Link>
            )}
          </Button>
        </div>
      </div>
      {covers.length > 0 && <CoverStack covers={covers} />}
    </section>
  );
}

function CoverStack({ covers }: { covers: FeaturedCourse[] }) {
  return (
    <div className="relative hidden h-96 lg:block" aria-hidden="true">
      {covers.slice(0, COVER_POSITIONS.length).map((course, index) => (
        <div
          key={course.id}
          className={`absolute w-80 overflow-hidden rounded-xl border border-border bg-card shadow-xl ${COVER_POSITIONS[index]}`}
        >
          <CourseImage
            src={course.coverImageUrl}
            alt=""
            className="aspect-video w-full object-cover"
          />
          <div className="px-4 py-3">
            <p className="truncate text-sm font-semibold">{course.title}</p>
            <p className="text-xs text-muted-foreground">
              {course.lessonCount} lessons · {course.instructorName}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
