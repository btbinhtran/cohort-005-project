import type { QuizPassRate } from "~/modules/instructor-analytics/index.server";

/**
 * How each quiz is going, one row apiece.
 *
 * The basis is spelled out above the table rather than left implied: retakes
 * are allowed, so "pass rate" has more than one defensible meaning and the
 * reader cannot tell which one they are looking at from the number alone.
 */
export function QuizPassRates({ quizzes }: { quizzes: QuizPassRate[] }) {
  if (quizzes.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        This course has no quizzes yet. Add one to a lesson to see how students
        do on it.
      </p>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="pb-2 font-medium">Quiz</th>
          <th className="pb-2 text-right font-medium">Students</th>
          <th className="pb-2 text-right font-medium">Passed</th>
          <th className="pb-2 text-right font-medium">Pass rate</th>
          <th className="pb-2 text-right font-medium">Average score</th>
        </tr>
      </thead>
      <tbody>
        {quizzes.map((quiz) => (
          <tr key={quiz.quizId} className="border-b">
            <td className="py-3">
              <div className="font-medium">{quiz.title}</div>
              <div className="text-xs text-muted-foreground">
                {quiz.moduleTitle} · {quiz.lessonTitle} · passes at{" "}
                {quiz.passingScorePercent}%
              </div>
            </td>
            {quiz.passRatePercent === null ? (
              // Untaken, not failed: a zero here would read as a quiz everyone
              // is flunking, which calls for the opposite reaction.
              <td
                className="py-3 text-right text-xs text-muted-foreground"
                colSpan={4}
              >
                Nobody has attempted this quiz in this period.
              </td>
            ) : (
              <>
                <td className="py-3 text-right tabular-nums">
                  {quiz.studentCount}
                </td>
                <td className="py-3 text-right tabular-nums">
                  {quiz.passedCount}
                </td>
                <td className="py-3 text-right font-medium tabular-nums">
                  {quiz.passRatePercent}%
                </td>
                <td className="py-3 text-right tabular-nums text-muted-foreground">
                  {quiz.averageBestScorePercent}%
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
