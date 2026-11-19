import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "~/db/schema";

export type Db = BetterSQLite3Database<typeof schema>;

/** Fixes the database argument of a query, so callers pass only the rest. */
export function bindDb<A extends unknown[], R>(
  database: Db,
  query: (db: Db, ...args: A) => R
) {
  return (...args: A) => query(database, ...args);
}
