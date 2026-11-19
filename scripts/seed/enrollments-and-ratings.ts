import { countRows, db, type Course, type User } from "./db";
import { daysAgo } from "./helpers";
import * as schema from "../../app/db/schema";

export function seedEnrollmentsAndRatings({
  students,
  course1,
  course2,
}: {
  students: User[];
  course1: Course;
  course2: Course;
}) {
  // ─── Enrollments ───
  // Varied enrollment patterns:
  // - Emma: enrolled in both courses (nearly complete in course 1, mid-way in course 2)
  // - James: enrolled in course 1 only (completed)
  // - Olivia: enrolled in both courses (just started course 1, mid-way in course 2)
  // - Liam: enrolled in course 2 only (just started, abandoned)
  // - Sophia: enrolled in course 1 only (recently enrolled, barely started)

  db.insert(schema.enrollments)
    .values([
      { userId: students[0].id, courseId: course1.id, enrolledAt: daysAgo(50) },
      { userId: students[0].id, courseId: course2.id, enrolledAt: daysAgo(40) },
      {
        userId: students[1].id,
        courseId: course1.id,
        enrolledAt: daysAgo(45),
        completedAt: daysAgo(10),
      },
      { userId: students[2].id, courseId: course1.id, enrolledAt: daysAgo(35) },
      { userId: students[2].id, courseId: course2.id, enrolledAt: daysAgo(30) },
      { userId: students[3].id, courseId: course2.id, enrolledAt: daysAgo(25) },
      { userId: students[4].id, courseId: course1.id, enrolledAt: daysAgo(15) },
    ])
    .run();

  console.log(`Created ${countRows(schema.enrollments)} enrollments.`);

  // ─── Course Ratings ───
  // Star ratings from enrolled students only. Not everyone rates.
  // Course 1 averages 4.3 (4 ratings), course 2 averages 4.5 (2 ratings).

  db.insert(schema.courseRatings)
    .values([
      {
        userId: students[0].id,
        courseId: course1.id,
        rating: 5,
        createdAt: daysAgo(20),
        updatedAt: daysAgo(20),
      },
      {
        userId: students[1].id,
        courseId: course1.id,
        rating: 5,
        createdAt: daysAgo(9),
        updatedAt: daysAgo(9),
      },
      {
        userId: students[2].id,
        courseId: course1.id,
        rating: 4,
        createdAt: daysAgo(18),
        updatedAt: daysAgo(18),
      },
      {
        userId: students[4].id,
        courseId: course1.id,
        rating: 3,
        createdAt: daysAgo(5),
        updatedAt: daysAgo(5),
      },
      {
        userId: students[0].id,
        courseId: course2.id,
        rating: 4,
        createdAt: daysAgo(12),
        updatedAt: daysAgo(12),
      },
      {
        userId: students[3].id,
        courseId: course2.id,
        rating: 5,
        createdAt: daysAgo(8),
        updatedAt: daysAgo(8),
      },
    ])
    .run();

  console.log(`Created ${countRows(schema.courseRatings)} course ratings.`);
}
