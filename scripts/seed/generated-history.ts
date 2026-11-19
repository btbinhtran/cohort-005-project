import { db, type Course, type User } from "./db";
import { daysAgo, makeRandom } from "./helpers";
import { addWatchSession } from "./watch-events";
import * as schema from "../../app/db/schema";
import { LessonProgressStatus } from "../../app/db/schema";

export function seedGeneratedHistory({
  cohort,
  course1,
  course1LessonIds,
  course2,
  course2LessonIds,
  course3,
  course3LessonIds,
}: {
  cohort: User[];
  course1: Course;
  course1LessonIds: number[];
  course2: Course;
  course2LessonIds: number[];
  course3: Course;
  course3LessonIds: number[];
}) {
  // ─── Generated history ───
  //
  // Every earlier seed step is hand-written narrative data: a handful of
  // students whose comments, quiz attempts and ratings are written one by one.
  // Everything here is the bulk history the analytics work is evaluated against — roughly twelve
  // months of purchases, enrolments, progress and watch events for the cohort.
  //
  // Generated from a fixed PRNG seed, so every run produces the same database and
  // a number read off the dashboard can be checked against a number computed
  // here.

  const random = makeRandom(20260731);

  const lessonDurationSeconds = new Map(
    db
      .select({
        id: schema.lessons.id,
        durationMinutes: schema.lessons.durationMinutes,
      })
      .from(schema.lessons)
      .all()
      .map((l) => [l.id, (l.durationMinutes ?? 10) * 60] as const)
  );

  // ─── Drop-off cliffs ───
  //
  // Progress is not spread evenly through a course. Each course has two lessons
  // where a large share of students stop for good, and the analytics work is
  // expected to surface exactly these lessons. They are, by lesson index
  // (0-based, in course order):
  //
  //   Course 1 — Introduction to TypeScript
  //     index 8  "Generics Basics"                 — first cliff
  //     index 13 "Mapped Types"                    — second cliff
  //
  //   Course 2 — Building REST APIs with Node.js
  //     index 5  "Custom Middleware"               — first cliff
  //     index 11 "Transactions"                    — second cliff
  //
  //   Course 3 — Design Systems with Tailwind
  //     index 3  "Variants and Composition"        — first cliff
  //     index 6  "Documentation That Gets Read"    — second cliff
  //
  // Assert against the lessons, not against a drop-off percentage. Each enrolment
  // rolls: 12% never start, 38% stop at the first cliff, 22% at the second, 13%
  // finish, and the remaining 15% stop at a uniformly random lesson — so the
  // cliffs stand out against a noisy background rather than being the only
  // stopping points. Those are per-enrolment odds, not the share of students who
  // reach a given lesson: because students who stop at the first cliff never
  // reach the second, the observed drop-off at each cliff is much steeper than
  // its roll.

  type SellableCourse = {
    course: typeof course1;
    lessonIds: number[];
    // [bigCliffIndex, secondCliffIndex] — the lesson a stopping student last
    // completed.
    cliffs: [number, number];
  };

  const sellableCourses: SellableCourse[] = [
    { course: course1, lessonIds: course1LessonIds, cliffs: [8, 13] },
    { course: course2, lessonIds: course2LessonIds, cliffs: [5, 11] },
    { course: course3, lessonIds: course3LessonIds, cliffs: [3, 6] },
  ];

  const fullPriceCountries = ["US", "GB", "DE", "CA", "AU", "NL"];
  const pppCountries = ["IN", "BR", "PH", "NG", "ID", "VN"];

  const sold = new Set<string>();
  let generatedPurchases = 0;
  let generatedEnrollments = 0;
  let generatedProgressRows = 0;

  // A student buys, enrols, and works through the course as far as they get.
  // Returns false if there was nothing they could have bought on that day — a
  // course cannot be sold before it was created, and nobody buys twice.
  function buyCourse(
    buyer: (typeof cohort)[number],
    purchasedDaysAgo: number
  ): boolean {
    const purchasedAt = Date.parse(daysAgo(purchasedDaysAgo));

    const available = sellableCourses.filter(
      (c) =>
        Date.parse(c.course.createdAt) <= purchasedAt &&
        !sold.has(`${buyer.id}:${c.course.id}`)
    );

    if (available.length === 0) return false;

    const target = available[Math.floor(random() * available.length)];
    sold.add(`${buyer.id}:${target.course.id}`);

    // Two in five buy at a parity-adjusted price.
    const ppp = random() < 0.4;
    const country = ppp
      ? pppCountries[Math.floor(random() * pppCountries.length)]
      : fullPriceCountries[Math.floor(random() * fullPriceCountries.length)];
    const amountPaid = ppp
      ? Math.round((target.course.price * 0.5) / 100) * 100
      : target.course.price;

    db.insert(schema.purchases)
      .values({
        userId: buyer.id,
        courseId: target.course.id,
        amountPaid,
        country,
        createdAt: daysAgo(purchasedDaysAgo),
      })
      .run();
    generatedPurchases++;

    db.insert(schema.enrollments)
      .values({
        userId: buyer.id,
        courseId: target.course.id,
        enrolledAt: daysAgo(purchasedDaysAgo),
      })
      .run();
    generatedEnrollments++;

    generatedProgressRows += generateProgress(
      buyer.id,
      target,
      purchasedDaysAgo
    );

    return true;
  }

  const signupDaysAgo = (student: (typeof cohort)[number]) =>
    Math.round((Date.now() - Date.parse(student.createdAt)) / 86_400_000);

  // Purchases hang off sign-up dates, which already span the year: everyone buys
  // something within days of joining, and about two in five come back for a
  // second course a few months later.
  for (const buyer of cohort) {
    const joined = signupDaysAgo(buyer);

    buyCourse(buyer, Math.max(0, joined - Math.floor(random() * 4)));

    if (random() < 0.42) {
      buyCourse(buyer, Math.max(1, joined - 90 - Math.floor(random() * 20)));
    }
  }

  // Launch week: a burst of sales from long-standing students inside the last
  // seven days, so the short date ranges are never empty and never identical to
  // the long ones.
  const launchWeekDays = [7, 6, 5, 3, 2, 1];
  const longStanding = cohort.filter((s) => signupDaysAgo(s) > 60);

  for (let i = 0; i < launchWeekDays.length; i++) {
    buyCourse(longStanding[i % longStanding.length], launchWeekDays[i]);
  }

  // Walks a student through a course as far as they got, leaving the lesson
  // after their last completed one in progress. Returns the number of rows
  // written.
  function generateProgress(
    userId: number,
    target: SellableCourse,
    startedDaysAgo: number
  ): number {
    const { lessonIds, cliffs } = target;
    const lastIndex = lessonIds.length - 1;

    const roll = random();
    let stopIndex: number;

    if (roll < 0.12) {
      // Bought it and never opened it.
      return 0;
    } else if (roll < 0.5) {
      stopIndex = cliffs[0];
    } else if (roll < 0.72) {
      stopIndex = cliffs[1];
    } else if (roll < 0.85) {
      stopIndex = lastIndex;
    } else {
      stopIndex = Math.floor(random() * lessonIds.length);
    }

    // Progress is made over the days following the purchase, and never in the
    // future.
    const daySpan = Math.min(startedDaysAgo, 30);
    let rows = 0;

    for (let li = 0; li <= stopIndex; li++) {
      const completedDaysAgo = Math.max(
        0,
        Math.round(startedDaysAgo - (daySpan * li) / lessonIds.length)
      );
      db.insert(schema.lessonProgress)
        .values({
          userId,
          lessonId: lessonIds[li],
          status: LessonProgressStatus.Completed,
          completedAt: daysAgo(completedDaysAgo),
        })
        .run();
      rows++;

      // The lesson they stopped on is left half-watched: a session that never
      // reached the end, heartbeats and all.
      if (li === stopIndex) {
        const duration = lessonDurationSeconds.get(lessonIds[li]) ?? 600;
        addWatchSession(
          userId,
          lessonIds[li],
          0,
          duration,
          duration,
          completedDaysAgo * 24 + 1
        );
      }
    }

    if (stopIndex < lastIndex) {
      const nextLessonId = lessonIds[stopIndex + 1];
      db.insert(schema.lessonProgress)
        .values({
          userId,
          lessonId: nextLessonId,
          status: LessonProgressStatus.InProgress,
        })
        .run();
      rows++;

      const duration = lessonDurationSeconds.get(nextLessonId) ?? 600;
      const abandonedAt = Math.round(duration * (0.1 + random() * 0.5));
      addWatchSession(
        userId,
        nextLessonId,
        0,
        abandonedAt,
        duration,
        Math.max(1, Math.round(startedDaysAgo * 24 * 0.4))
      );
    }

    return rows;
  }

  console.log(
    `Created ${generatedPurchases} generated purchases, ${generatedEnrollments} enrolments and ${generatedProgressRows} lesson progress rows.`
  );
}
