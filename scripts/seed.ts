import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { defaultNotifications } from "../app/lib/notifications.server";
import { syncAllUsers } from "../app/lib/notification-preferences.server";
import { db, sqlite } from "./seed/db";
import { seedUsers } from "./seed/users";
import { seedCategories } from "./seed/categories";
import { seedTypeScriptCourse } from "./seed/courses/typescript";
import { seedRestApisCourse } from "./seed/courses/rest-apis";
import { seedDesignSystemsCourse } from "./seed/courses/design-systems";
import { seedDataVisualisationCourse } from "./seed/courses/data-visualisation";
import { seedDockerKubernetesCourse } from "./seed/courses/docker-kubernetes";
import { seedQuizzes } from "./seed/quizzes";
import { seedEnrollmentsAndRatings } from "./seed/enrollments-and-ratings";
import { seedComments } from "./seed/comments";
import { seedLessonProgress } from "./seed/lesson-progress";
import { seedQuizAttempts } from "./seed/quiz-attempts";
import {
  flushWatchEvents,
  seedNarrativeWatchEvents,
} from "./seed/watch-events";
import { seedPurchasesAndTeam } from "./seed/purchases-and-teams";
import { seedGeneratedHistory } from "./seed/generated-history";
import { seedTeamLicences } from "./seed/team-licences";
import { seedRefundRequests } from "./seed/refund-requests";
import { printSummary } from "./seed/summary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsFolder = path.resolve(__dirname, "../drizzle");

// Runs under tsx, not Vite, so load .env for the Knock keys ourselves.
const envFile = path.resolve(__dirname, "../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

// ─── Seed Data ───
//
// Each step lives in scripts/seed/. The steps run in this order because row
// ids, and the PRNG sequence of the generated history, depend on it.

async function seed() {
  console.log("Seeding database...");

  // Drop and recreate tables for a clean seed
  sqlite.exec(`
    DROP TABLE IF EXISTS bookmarks;
    DROP TABLE IF EXISTS notes;
    DROP TABLE IF EXISTS comments;
    DROP TABLE IF EXISTS course_ratings;
    DROP TABLE IF EXISTS video_watch_events;
    DROP TABLE IF EXISTS quiz_answers;
    DROP TABLE IF EXISTS quiz_attempts;
    DROP TABLE IF EXISTS quiz_options;
    DROP TABLE IF EXISTS quiz_questions;
    DROP TABLE IF EXISTS quizzes;
    DROP TABLE IF EXISTS lesson_progress;
    DROP TABLE IF EXISTS coupons;
    DROP TABLE IF EXISTS team_members;
    DROP TABLE IF EXISTS teams;
    DROP TABLE IF EXISTS refunds;
    DROP TABLE IF EXISTS purchases;
    DROP TABLE IF EXISTS enrollments;
    DROP TABLE IF EXISTS lessons;
    DROP TABLE IF EXISTS modules;
    DROP TABLE IF EXISTS courses;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS __drizzle_migrations;
  `);

  // Create tables using the same Drizzle migrations as the live database
  migrate(db, { migrationsFolder });

  console.log("Tables created.");

  const {
    admin,
    instructor1,
    instructor2,
    students,
    bossy,
    cohort,
    studentByEmail,
  } = seedUsers();
  const catBySlug = seedCategories();

  const { course1, course1LessonIds } = seedTypeScriptCourse({
    instructor1,
    catBySlug,
  });
  const { course2, course2LessonIds } = seedRestApisCourse({
    instructor2,
    catBySlug,
  });
  const { course3, course3LessonIds } = seedDesignSystemsCourse({
    instructor1,
    catBySlug,
  });
  seedDataVisualisationCourse({ instructor2, catBySlug });
  seedDockerKubernetesCourse({ instructor2, catBySlug });

  const quizzes = seedQuizzes({ course1LessonIds, course2LessonIds });

  seedEnrollmentsAndRatings({ students, course1, course2 });
  seedComments({
    admin,
    instructor1,
    instructor2,
    students,
    course1LessonIds,
    course2LessonIds,
  });
  seedLessonProgress({ students, course1LessonIds, course2LessonIds });
  seedQuizAttempts({ students, ...quizzes });
  seedNarrativeWatchEvents({ students, course1LessonIds, course2LessonIds });
  seedPurchasesAndTeam({ students, bossy, course1, course2, studentByEmail });

  seedGeneratedHistory({
    cohort,
    course1,
    course1LessonIds,
    course2,
    course2LessonIds,
    course3,
    course3LessonIds,
  });

  const novakLicence = seedTeamLicences({ studentByEmail, course1, course3 });
  seedRefundRequests({
    studentByEmail,
    course1,
    course1LessonIds,
    novakLicence,
  });

  flushWatchEvents();

  printSummary();

  // ─── Sync users to Knock ───
  // Name, email, avatar, and default preferences for anyone without a set.
  if (process.env.KNOCK_SECRET_API_KEY) {
    const synced = await syncAllUsers(db, await defaultNotifications());
    console.log(`  Synced ${synced} users to Knock.`);
  } else {
    console.log("  Skipped Knock user sync: KNOCK_SECRET_API_KEY is not set.");
  }
}

seed().catch(console.error);
