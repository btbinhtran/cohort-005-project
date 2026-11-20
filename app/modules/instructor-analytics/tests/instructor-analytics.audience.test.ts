import { describe, it, expect, beforeEach } from "vitest";
import type * as schema from "~/db/schema";
import {
  instructor,
  otherInstructor,
  admin,
  course,
  otherCourse,
  addUser,
  addModule,
  addLesson,
  buy,
  buySeats,
  enroll,
  claimSeat,
  rate,
  comment,
  asInstructor,
  asAdmin,
  setUpFixtures,
} from "./fixtures";

beforeEach(setUpFixtures);

describe("audience", () => {
  it("counts buyers and students separately, sharing a team licence across its claimed seats", () => {
    const soloBuyer = addUser("Alice Solo");
    buy(soloBuyer.id, course.id, 10000);
    enroll(soloBuyer.id, course.id);

    const teamBuyer = addUser("Bob Manager");
    const { seats } = buySeats(teamBuyer.id, course.id, 3, 9999);
    claimSeat(seats[0], addUser("Cat Claimer").id);
    claimSeat(seats[1], addUser("Dan Claimer").id);

    // Students: Alice (10000), Cat and Dan (a third of 9999 each).
    expect(asInstructor().audience).toEqual({
      buyerCount: 2,
      studentCount: 3,
      revenuePerStudentCents: 5555,
    });
  });

  it("has no revenue per student when nobody is enrolled", () => {
    buy(addUser("Alice Solo").id, course.id, 10000);

    expect(asInstructor().audience).toEqual({
      buyerCount: 1,
      studentCount: 0,
      revenuePerStudentCents: null,
    });
  });

  it("only counts students who enrolled inside the range", () => {
    enroll(addUser("Recent").id, course.id, 3);
    enroll(addUser("Long Ago").id, course.id, 60);

    expect(asInstructor({ range: "30d" }).audience.studentCount).toBe(1);
    expect(asInstructor({ range: "all" }).audience.studentCount).toBe(2);
  });

  it("credits a student only for what they paid on this instructor's courses", () => {
    const student = addUser("Alice Solo");
    buy(student.id, course.id, 4000);
    buy(student.id, otherCourse.id, 9000);
    enroll(student.id, course.id);

    expect(asInstructor().audience.revenuePerStudentCents).toBe(4000);
  });

  it("credits a team buyer who claims their own seat only for that seat", () => {
    const manager = addUser("Bob Manager");
    const { seats } = buySeats(manager.id, course.id, 2, 10000);
    claimSeat(seats[0], manager.id);
    claimSeat(seats[1], addUser("Cat Claimer").id);

    expect(asInstructor().audience).toEqual({
      buyerCount: 1,
      studentCount: 2,
      revenuePerStudentCents: 5000,
    });
  });
});

describe("top buyers", () => {
  it("ranks buyers by spend, with their seats and whether they enrolled", () => {
    const soloBuyer = addUser("Alice Solo");
    buy(soloBuyer.id, course.id, 10000);
    enroll(soloBuyer.id, course.id);

    const teamBuyer = addUser("Bob Manager");
    const { seats } = buySeats(teamBuyer.id, course.id, 3, 9999);
    claimSeat(seats[0], addUser("Cat Claimer").id);
    claimSeat(seats[1], addUser("Dan Claimer").id);

    expect(asInstructor().buyers).toEqual([
      {
        userId: soloBuyer.id,
        name: "Alice Solo",
        email: "alice.solo@example.com",
        spendCents: 10000,
        purchaseCount: 1,
        seatsBought: 0,
        seatsUnredeemed: 0,
        enrolled: true,
      },
      {
        userId: teamBuyer.id,
        name: "Bob Manager",
        email: "bob.manager@example.com",
        spendCents: 9999,
        purchaseCount: 1,
        seatsBought: 3,
        seatsUnredeemed: 1,
        enrolled: false,
      },
    ]);
  });

  it("does not multiply a team licence's spend by its seat count", () => {
    const teamBuyer = addUser("Bob Manager");
    buySeats(teamBuyer.id, course.id, 5, 20000);

    expect(asInstructor().buyers[0]).toMatchObject({
      spendCents: 20000,
      purchaseCount: 1,
      seatsBought: 5,
    });
  });

  it("shows only the top ten", () => {
    for (let rank = 1; rank <= 11; rank++) {
      buy(addUser(`Buyer ${rank}`).id, course.id, rank * 100);
    }

    const buyers = asInstructor().buyers;

    expect(buyers).toHaveLength(10);
    expect(buyers[0].name).toBe("Buyer 11");
    expect(buyers.at(-1)?.name).toBe("Buyer 2");
  });

  it("counts an enrolment from before the range", () => {
    const buyer = addUser("Alice Solo");
    enroll(buyer.id, course.id, 200);
    buy(buyer.id, course.id, 1000, { daysBack: 2 });

    expect(asInstructor({ range: "7d" }).buyers[0].enrolled).toBe(true);
  });

  it("does not count an enrolment on another instructor's course", () => {
    const buyer = addUser("Alice Solo");
    buy(buyer.id, course.id, 1000);
    enroll(buyer.id, otherCourse.id);

    expect(asInstructor().buyers[0].enrolled).toBe(false);
  });

  it("only counts spend inside the range", () => {
    const buyer = addUser("Alice Solo");
    buy(buyer.id, course.id, 1000, { daysBack: 2 });
    buy(buyer.id, course.id, 5000, { daysBack: 60 });

    expect(asInstructor({ range: "30d" }).buyers[0].spendCents).toBe(1000);
  });
});

describe("ratings", () => {
  it("averages ratings in the range to one decimal place", () => {
    rate(addUser("A").id, course.id, 5);
    rate(addUser("B").id, course.id, 4);
    rate(addUser("C").id, course.id, 4);
    rate(addUser("D").id, course.id, 1, 40);
    rate(addUser("E").id, otherCourse.id, 1);

    expect(asInstructor({ range: "30d" }).ratings).toEqual({
      average: 4.3,
      count: 3,
    });
  });

  it("has no average without ratings", () => {
    expect(asInstructor().ratings).toEqual({ average: null, count: 0 });
  });
});

describe("unanswered questions", () => {
  let lessonId: number;
  let student: typeof schema.users.$inferSelect;

  beforeEach(() => {
    const module = addModule(course.id, "Basics", 1);
    lessonId = addLesson(module.id, "Lesson 1", 1).id;
    student = addUser("Sam Student");
  });

  it("counts a student's question nobody has answered", () => {
    comment(lessonId, student.id);

    expect(asInstructor().questions).toEqual({ inRange: 1, older: 0 });
  });

  it("does not count a question the course's instructor answered", () => {
    const question = comment(lessonId, student.id);
    comment(lessonId, instructor.id, { parentId: question.id });

    expect(asInstructor().questions).toEqual({ inRange: 0, older: 0 });
  });

  it("does not count a question an admin answered", () => {
    const question = comment(lessonId, student.id);
    comment(lessonId, admin.id, { parentId: question.id });

    expect(asInstructor().questions).toEqual({ inRange: 0, older: 0 });
  });

  it("still counts a question only another student answered", () => {
    const question = comment(lessonId, student.id);
    comment(lessonId, addUser("Helpful Peer").id, { parentId: question.id });

    expect(asInstructor().questions).toEqual({ inRange: 1, older: 0 });
  });

  it("still counts a question answered by an instructor of a different course", () => {
    const question = comment(lessonId, student.id);
    comment(lessonId, otherInstructor.id, { parentId: question.id });

    expect(asInstructor().questions).toEqual({ inRange: 1, older: 0 });
  });

  it("still counts a question whose staff reply was deleted", () => {
    const question = comment(lessonId, student.id);
    comment(lessonId, instructor.id, { parentId: question.id, deleted: true });

    expect(asInstructor().questions).toEqual({ inRange: 1, older: 0 });
  });

  it("does not count a deleted question", () => {
    comment(lessonId, student.id, { deleted: true });

    expect(asInstructor().questions).toEqual({ inRange: 0, older: 0 });
  });

  it("does not count questions staff asked", () => {
    comment(lessonId, instructor.id);
    comment(lessonId, admin.id);

    expect(asInstructor().questions).toEqual({ inRange: 0, older: 0 });
  });

  it("does not count replies as questions", () => {
    const question = comment(lessonId, student.id);
    comment(lessonId, addUser("Helpful Peer").id, { parentId: question.id });
    comment(lessonId, student.id, { parentId: question.id });

    expect(asInstructor().questions).toEqual({ inRange: 1, older: 0 });
  });

  it("reports questions older than the range rather than dropping them", () => {
    comment(lessonId, student.id, { daysBack: 2 });
    comment(lessonId, student.id, { daysBack: 100 });

    expect(asInstructor({ range: "30d" }).questions).toEqual({
      inRange: 1,
      older: 1,
    });
    expect(asInstructor({ range: "all" }).questions).toEqual({
      inRange: 2,
      older: 0,
    });
  });

  it("ignores questions on another instructor's courses", () => {
    const otherModule = addModule(otherCourse.id, "Elsewhere", 1);
    comment(addLesson(otherModule.id, "Their lesson", 1).id, student.id);

    expect(asInstructor().questions).toEqual({ inRange: 0, older: 0 });
    expect(asAdmin().questions).toEqual({ inRange: 1, older: 0 });
  });
});
