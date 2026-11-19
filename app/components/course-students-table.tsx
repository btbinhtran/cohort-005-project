import { Award, Users } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";

export type CourseStudentQuizScore = {
  quizId: number;
  quizTitle: string;
  lessonTitle: string;
  bestScore: number | null;
  passed: boolean | null;
};

export type CourseStudent = {
  userId: number;
  name: string;
  email: string;
  enrolledAt: string;
  completedAt: string | null;
  progress: number;
  quizScores: CourseStudentQuizScore[];
};

export type CourseStudentsTableProps = {
  students: CourseStudent[];
  quizCount: number;
};

/** The enrolled students, their progress and their best quiz scores. */
export function CourseStudentsTable({
  students,
  quizCount,
}: CourseStudentsTableProps) {
  return (
    <>
      <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Users className="size-4" />
          {students.length} {students.length === 1 ? "student" : "students"}{" "}
          enrolled
        </span>
        {quizCount > 0 && (
          <span className="flex items-center gap-1.5">
            <Award className="size-4" />
            {quizCount} {quizCount === 1 ? "quiz" : "quizzes"}
          </span>
        )}
      </div>

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="mx-auto mb-3 size-8 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No students enrolled in this course yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Student
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Enrolled
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Progress
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    {quizCount > 0 && (
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Quiz Scores
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const enrolledDate = new Date(
                      student.enrolledAt
                    ).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });

                    return (
                      <tr
                        key={student.userId}
                        className="border-b border-border last:border-0"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium">
                              {student.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {student.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {enrolledDate}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 rounded-full bg-muted">
                              <div
                                className="h-2 rounded-full bg-primary transition-all"
                                style={{ width: `${student.progress}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">
                              {student.progress}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {student.completedAt ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              Completed
                            </span>
                          ) : student.progress > 0 ? (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              In Progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                              Not Started
                            </span>
                          )}
                        </td>
                        {quizCount > 0 && (
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {student.quizScores.map((qs) => (
                                <div
                                  key={qs.quizId}
                                  className="flex items-center gap-1"
                                  title={`${qs.quizTitle} (${qs.lessonTitle})`}
                                >
                                  {qs.bestScore === null ? (
                                    <span className="text-xs text-muted-foreground">
                                      —
                                    </span>
                                  ) : qs.passed ? (
                                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                      {Math.round(qs.bestScore * 100)}%
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                      {Math.round(qs.bestScore * 100)}%
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
