import { db } from "./db";
import { daysAgo, slugify } from "./helpers";
import * as schema from "../../app/db/schema";
import { UserRole } from "../../app/db/schema";

export function seedUsers() {
  // ─── Users ───
  // 1 admin, 3 instructors (one of whom owns no courses, so the empty
  // instructor dashboard is reachable), and ~40 students.
  //
  // Students are split in two: the five named students below, who own all the
  // hand-written narrative data (comments, quiz attempts, ratings), and the
  // cohort generated below, which supplies volume. Anything that picks a
  // student out of a list does it by email, never by array position — see
  // studentByEmail — so appending or inserting students never silently
  // re-points a coupon redemption at someone else.

  const [admin] = db
    .insert(schema.users)
    .values({
      name: "Alex Rivera",
      email: "alex.rivera@ralph.dev",
      role: UserRole.Admin,
      avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=alex",
      createdAt: daysAgo(120),
    })
    .returning()
    .all();

  const [instructor1] = db
    .insert(schema.users)
    .values({
      name: "Sarah Chen",
      email: "sarah.chen@ralph.dev",
      role: UserRole.Instructor,
      avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=sarah",
      bio: "Senior TypeScript engineer with 10 years of experience building large-scale web applications. Previously at Stripe and Vercel. Passionate about type safety and developer tooling.",
      createdAt: daysAgo(100),
    })
    .returning()
    .all();

  const [instructor2] = db
    .insert(schema.users)
    .values({
      name: "Marcus Johnson",
      email: "marcus.johnson@ralph.dev",
      role: UserRole.Instructor,
      avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=marcus",
      bio: "Full-stack developer and API architect specializing in Node.js and cloud infrastructure. Has built and scaled APIs serving millions of requests daily. Conference speaker and open-source contributor.",
      createdAt: daysAgo(95),
    })
    .returning()
    .all();

  // Owns no courses — the instructor views must survive an instructor with
  // nothing to show.
  db.insert(schema.users)
    .values({
      name: "Priya Nair",
      email: "priya.nair@ralph.dev",
      role: UserRole.Instructor,
      avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=priya",
      bio: "Accessibility engineer and design-systems consultant. Joined to teach, has not published a course yet.",
      createdAt: daysAgo(210),
    })
    .returning()
    .all();

  const students = db
    .insert(schema.users)
    .values([
      {
        name: "Emma Wilson",
        email: "emma.wilson@student.dev",
        role: UserRole.Student,
        avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=emma",
        createdAt: daysAgo(60),
      },
      {
        name: "James Park",
        email: "james.park@student.dev",
        role: UserRole.Student,
        avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=james",
        createdAt: daysAgo(55),
      },
      {
        name: "Olivia Martinez",
        email: "olivia.martinez@student.dev",
        role: UserRole.Student,
        avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=olivia",
        createdAt: daysAgo(45),
      },
      {
        name: "Liam Thompson",
        email: "liam@example.com",
        role: UserRole.Student,
        avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=liam",
        createdAt: daysAgo(30),
      },
      {
        name: "Sophia Davis",
        email: "sophia.davis@student.dev",
        role: UserRole.Student,
        avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=sophia",
        createdAt: daysAgo(20),
      },
    ])
    .returning()
    .all();

  const [bossy] = db
    .insert(schema.users)
    .values({
      name: "Bossy McBossface",
      email: "bossy.mcbossface@student.dev",
      role: UserRole.Student,
      avatarUrl: "https://api.dicebear.com/9.x/avataaars/svg?seed=bossy",
      createdAt: daysAgo(40),
    })
    .returning()
    .all();

  // The wider student body. These carry the bulk purchase and progress history
  // generated in generated-history.ts. Sign-up dates are spread across the
  // last twelve months, including the last few days.
  const cohortNames = [
    "Ava Nakamura",
    "Noah Blackwood",
    "Isla Fernandes",
    "Ethan Okafor",
    "Mia Lindqvist",
    "Lucas Moreau",
    "Zara Haddad",
    "Felix Andersen",
    "Nina Kowalski",
    "Omar Rahman",
    "Chloe Beaumont",
    "Dmitri Volkov",
    "Priya Raghavan",
    "Tomas Silva",
    "Hana Kim",
    "Gabriel Rossi",
    "Amara Diallo",
    "Jonas Weber",
    "Lena Petrova",
    "Kwame Mensah",
    "Sofia Ricci",
    "Aarav Shah",
    "Freya Nilsen",
    "Diego Castillo",
    "Yuki Tanaka",
    "Rosa Delgado",
    "Idris Bello",
    "Clara Hoffmann",
    "Mateo Alvarez",
    "Elif Demir",
    "Ruben Ortiz",
    "Anika Bose",
    "Caleb Ncube",
    "Marta Novak",
  ];

  const cohort = db
    .insert(schema.users)
    .values(
      cohortNames.map((name, i) => ({
        name,
        // Matches the named students above: first.last@student.dev.
        email: `${slugify(name).replace(/-/g, ".")}@student.dev`,
        role: UserRole.Student,
        avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${slugify(name)}`,
        // Spread across ~12 months, tightening towards today so the recent
        // ranges are populated. The last few sign up inside the last week.
        createdAt: daysAgo(Math.round(355 - i * 10.4)),
      }))
    )
    .returning()
    .all();

  // Every student, named and generated. Look students up by email rather than
  // by index — see the note in the users header.
  const allStudents = [...students, bossy, ...cohort];
  const studentsByEmail = new Map(allStudents.map((s) => [s.email, s]));

  function studentByEmail(email: string) {
    const student = studentsByEmail.get(email);
    if (!student) throw new Error(`No seeded student with email ${email}`);
    return student;
  }

  const instructorCount = 3;
  const studentCount = allStudents.length;

  console.log(
    `Created ${1 + instructorCount + studentCount} users (1 admin, ${instructorCount} instructors, ${studentCount} students).`
  );

  return {
    admin,
    instructor1,
    instructor2,
    students,
    bossy,
    cohort,
    studentByEmail,
  };
}
