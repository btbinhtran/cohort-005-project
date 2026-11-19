import Database from "better-sqlite3";
import { sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "../../app/db/schema";

export const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export type User = typeof schema.users.$inferSelect;
export type Course = typeof schema.courses.$inferSelect;
export type Category = typeof schema.categories.$inferSelect;
export type StudentByEmail = (email: string) => User;

// Every count this script reports is read back out of the database. A written
// -down count is a count that goes stale the first time the data around it
// changes.
export function countRows(table: SQLiteTable, where?: SQL) {
  const query = db.select({ count: sql<number>`count(*)` }).from(table);
  return (where ? query.where(where) : query).get()?.count ?? 0;
}
