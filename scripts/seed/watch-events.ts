import { db, type User } from "./db";
import { hoursAgo } from "./helpers";
import * as schema from "../../app/db/schema";

// ─── Video Watch Events ───
//
// The only event types the player emits are `play`, `pause`, `ended` and
// `progress` — see app/components/youtube-player.tsx. `progress` is the
// heartbeat it posts every 10 seconds while the video is playing, so in real
// data it outnumbers every other type by an order of magnitude. Seed nothing
// the player cannot produce, and never a watch session without heartbeats.

const HEARTBEAT_INTERVAL_SECONDS = 10;

type WatchEventRow = typeof schema.videoWatchEvents.$inferInsert;

const watchEventRows: WatchEventRow[] = [];

function addWatchEvent(
  userId: number,
  lessonId: number,
  eventType: string,
  positionSeconds: number,
  eventHoursAgo: number
) {
  watchEventRows.push({
    userId,
    lessonId,
    eventType,
    positionSeconds,
    createdAt: hoursAgo(eventHoursAgo),
  });
}

// One watch session: `play`, a `progress` heartbeat every 10 seconds of
// playback, then `ended` if they reached the end or `pause` if they stopped
// short. Clock time advances with playback position, as it does in real life.
export function addWatchSession(
  userId: number,
  lessonId: number,
  fromSeconds: number,
  toSeconds: number,
  videoDurationSeconds: number,
  startHoursAgo: number
) {
  // Clock time runs backwards from startHoursAgo as playback advances.
  const hoursAgoAt = (position: number) =>
    startHoursAgo - (position - fromSeconds) / 3600;

  addWatchEvent(userId, lessonId, "play", fromSeconds, startHoursAgo);

  for (
    let pos = fromSeconds + HEARTBEAT_INTERVAL_SECONDS;
    pos < toSeconds;
    pos += HEARTBEAT_INTERVAL_SECONDS
  ) {
    addWatchEvent(userId, lessonId, "progress", pos, hoursAgoAt(pos));
  }

  const reachedEnd = toSeconds >= videoDurationSeconds;
  addWatchEvent(
    userId,
    lessonId,
    reachedEnd ? "ended" : "pause",
    toSeconds,
    hoursAgoAt(toSeconds)
  );
}

export function seedNarrativeWatchEvents({
  students,
  course1LessonIds,
  course2LessonIds,
}: {
  students: User[];
  course1LessonIds: number[];
  course2LessonIds: number[];
}) {
  // Emma watched course 1 lesson 1 (8 min video) in two sittings.
  addWatchSession(students[0].id, course1LessonIds[0], 0, 180, 480, 50 * 24);
  addWatchSession(students[0].id, course1LessonIds[0], 180, 480, 480, 49 * 24);

  // James watched it straight through.
  addWatchSession(students[1].id, course1LessonIds[0], 0, 480, 480, 45 * 24);

  // Liam started course 2 lesson 1 and gave up six minutes in.
  addWatchSession(students[3].id, course2LessonIds[0], 0, 300, 600, 22 * 24);
  addWatchSession(students[3].id, course2LessonIds[0], 300, 360, 600, 21 * 24);
}

export function flushWatchEvents() {
  // ─── Flush watch events ───
  // Batched: the heartbeat makes these by far the largest table, and one
  // statement per row would dominate the seed's runtime.

  const WATCH_EVENT_CHUNK = 400;
  for (let i = 0; i < watchEventRows.length; i += WATCH_EVENT_CHUNK) {
    db.insert(schema.videoWatchEvents)
      .values(watchEventRows.slice(i, i + WATCH_EVENT_CHUNK))
      .run();
  }

  console.log(`Created ${watchEventRows.length} video watch events.`);
}
