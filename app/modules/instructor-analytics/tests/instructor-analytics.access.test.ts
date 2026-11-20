import { describe, it, expect, beforeEach } from "vitest";
import { CourseStatus, UserRole } from "~/db/schema";
import {
  instructor,
  otherInstructor,
  admin,
  course,
  otherCourse,
  addUser,
  addCourse,
  buy,
  analytics,
  asInstructor,
  asAdmin,
  setUpFixtures,
} from "./fixtures";

beforeEach(setUpFixtures);

describe("who sees what", () => {
  it("pins an instructor to their own figures, whatever the URL says", () => {
    const student = addUser("Sam Student");
    buy(student.id, course.id, 1000);
    buy(student.id, otherCourse.id, 5000);

    const result = asInstructor({ instructor: String(otherInstructor.id) });

    expect(result.instructorId).toBe(instructor.id);
    expect(result.summary.grossCents).toBe(1000);
  });

  it("shows an admin every instructor's figures when none is picked", () => {
    const student = addUser("Sam Student");
    buy(student.id, course.id, 1000);
    buy(student.id, otherCourse.id, 5000);

    const result = asAdmin();

    expect(result.instructorId).toBeNull();
    expect(result.summary.grossCents).toBe(6000);
  });

  it("narrows an admin to the instructor they pick", () => {
    const student = addUser("Sam Student");
    buy(student.id, course.id, 1000);
    buy(student.id, otherCourse.id, 5000);

    const result = asAdmin({ instructor: String(otherInstructor.id) });

    expect(result.instructorId).toBe(otherInstructor.id);
    expect(result.summary.grossCents).toBe(5000);
  });

  it("treats a junk instructor param from an admin as platform-wide", () => {
    expect(asAdmin({ instructor: "-3" }).instructorId).toBeNull();
    expect(asAdmin({ instructor: "1.5" }).instructorId).toBeNull();
    expect(asAdmin({ instructor: "bob" }).instructorId).toBeNull();
  });

  it("lists course owners, by name, in the admin's instructor picker", () => {
    // An admin who owns a course is an owner too; an instructor with no
    // courses is not.
    addCourse(admin.id, "Admin's Course");
    addUser("Idle Instructor", UserRole.Instructor);

    expect(asAdmin().instructors).toEqual([
      { id: otherInstructor.id, name: "Olive Other" },
      { id: admin.id, name: "Pat Admin" },
      { id: instructor.id, name: "Test Instructor" },
    ]);
  });

  it("gives an instructor no instructor picker", () => {
    expect(asInstructor().instructors).toEqual([]);
  });

  it("flags itself as an admin view only for admins", () => {
    expect(asAdmin().isAdmin).toBe(true);
    expect(asInstructor().isAdmin).toBe(false);
  });
});

describe("search params", () => {
  it("falls back to the defaults when params are missing", () => {
    const result = asInstructor();

    expect(result.range).toBe("30d");
    expect(result.tab).toBe("overview");
    expect(result.selectedCourseId).toBeNull();
  });

  it("falls back to the defaults when params are junk", () => {
    const result = asInstructor({
      range: "forever",
      tab: "settings",
      course: "abc",
    });

    expect(result.range).toBe("30d");
    expect(result.tab).toBe("overview");
    expect(result.selectedCourseId).toBeNull();
  });

  it("reads a valid range and the course tab", () => {
    const result = asInstructor({ range: "90d", tab: "course" });

    expect(result.range).toBe("90d");
    expect(result.tab).toBe("course");
  });
});

describe("the course picker", () => {
  it("offers every course the viewer owns, sold or not, by title", () => {
    const zebra = addCourse(instructor.id, "Zebra Course", CourseStatus.Draft);
    const alpha = addCourse(instructor.id, "Alpha Course");

    expect(asInstructor().courseOptions).toEqual([
      { courseId: alpha.id, title: "Alpha Course" },
      { courseId: course.id, title: "Test Course" },
      { courseId: zebra.id, title: "Zebra Course" },
    ]);
  });

  it("selects a course the viewer owns", () => {
    const result = asInstructor({ tab: "course", course: String(course.id) });

    expect(result.selectedCourseId).toBe(course.id);
    expect(result.progress).not.toBeNull();
    expect(result.funnel).not.toBeNull();
    expect(result.quizzes).not.toBeNull();
    expect(result.countries).not.toBeNull();
  });

  it("refuses another instructor's course and hides every course panel", () => {
    const result = asInstructor({ course: String(otherCourse.id) });

    expect(result.selectedCourseId).toBeNull();
    expect(result.progress).toBeNull();
    expect(result.funnel).toBeNull();
    expect(result.quizzes).toBeNull();
    expect(result.countries).toBeNull();
  });

  it("refuses a course id that doesn't exist", () => {
    expect(asInstructor({ course: "9999" }).selectedCourseId).toBeNull();
  });

  it("lets an admin pick any course when viewing platform-wide", () => {
    expect(asAdmin({ course: String(otherCourse.id) }).selectedCourseId).toBe(
      otherCourse.id
    );
  });
});

describe("the publish-your-first-course prompt", () => {
  it("shows for an instructor with nothing published", () => {
    const newcomer = addUser("New Instructor", UserRole.Instructor);
    addCourse(newcomer.id, "Work in progress", CourseStatus.Draft);

    expect(analytics({ userId: newcomer.id, isAdmin: false }).unpublished).toBe(
      true
    );
  });

  it("hides once the instructor has published a course", () => {
    expect(asInstructor().unpublished).toBe(false);
  });

  it("never shows on the platform-wide view", () => {
    expect(asAdmin().unpublished).toBe(false);
  });
});
