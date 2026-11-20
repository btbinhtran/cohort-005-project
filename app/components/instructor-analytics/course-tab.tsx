import type { InstructorAnalytics } from "~/modules/instructor-analytics/index.server";
import { Card, CardContent } from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { CourseProgress } from "./course-progress";
import { CourseRevenueTable } from "./course-revenue-table";
import { DropOffFunnel } from "./drop-off-funnel";
import { QuizPassRates } from "./quiz-pass-rates";
import { RevenueByCountry } from "./revenue-by-country";

type CourseTabProps = Pick<
  InstructorAnalytics,
  "courseOptions" | "progress" | "funnel" | "quizzes" | "countries"
> & {
  selectedCourse: InstructorAnalytics["courseOptions"][number] | null;
  revenueRows: InstructorAnalytics["courses"];
  setParam: (key: string, value: string | null) => void;
};

/** The course detail tab: one course's progress, drop-off, quizzes and sales. */
export function CourseTab({
  selectedCourse,
  courseOptions,
  progress,
  funnel,
  quizzes,
  countries,
  revenueRows,
  setParam,
}: CourseTabProps) {
  return (
    <>
      <Select
        value={selectedCourse ? String(selectedCourse.courseId) : "all"}
        onValueChange={(value) =>
          setParam("course", value === "all" ? null : value)
        }
      >
        <SelectTrigger aria-label="Course" className="w-72">
          <SelectValue>{selectedCourse?.title ?? "All courses"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All courses</SelectItem>
          {courseOptions.map((course) => (
            <SelectItem key={course.courseId} value={String(course.courseId)}>
              {course.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {progress && funnel ? (
        progress.enrolledCount === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="font-medium">Nobody is enrolled yet</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Progress and drop-off appear as soon as the first student joins{" "}
                {selectedCourse?.title}.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <CourseProgress progress={progress} />

            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold">Drop-off</h2>
                <p className="mb-4 text-sm text-muted-foreground">
                  How many of the {funnel.enrolledCount} enrolled{" "}
                  {funnel.enrolledCount === 1 ? "student" : "students"} got at
                  least as far as each lesson, all time. The bars only descend,
                  so the biggest gap is where students quit — the figure beside
                  a lesson counts the ones who never reached it, having stopped
                  on the lesson above.
                </p>
                <DropOffFunnel funnel={funnel} />
              </CardContent>
            </Card>
          </>
        )
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">Pick a course</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {courseOptions.length === 0
                ? "There are no courses here to look into yet."
                : "Choose one of your courses above to see how far students get and where they give up."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Both panels sit outside the enrolment gate above: a quiz with
        nobody enrolled to sit it, and money arriving before anybody
        claims their seat, are things an instructor should still be
        told about rather than shown one "nobody is enrolled" card in
        place of. */}
      {quizzes && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold">Quiz results</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              One result per student per quiz, counting their best attempt — the
              same basis as the student roster. Retakes are not counted
              separately, so a quiz people get on the second go still reads as
              passed. Attempts made in this period only.
            </p>
            <QuizPassRates quizzes={quizzes} />
          </CardContent>
        </Card>
      )}

      {countries && (
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold">Revenue by country</h2>
            <RevenueByCountry breakdown={countries} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <CourseRevenueTable revenueRows={revenueRows} />
        </CardContent>
      </Card>
    </>
  );
}
