import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { eq } from 'drizzle-orm';
import { guilds } from './schema.ts';

export type Db = BetterSQLite3Database<Record<string, never>> & { $client: Database.Database };

export type SwogState = {
  readonly swog: boolean;
  /** Null when the guild has never swogged. */
  readonly since: Date | null;
};

const NEVER_SWOGGED: SwogState = { swog: false, since: null };

/**
 * Open the database, apply migrations, return a handle.
 *
 * Pass ':memory:' for tests. Migrations run on every boot; they are idempotent,
 * and this means a fresh deploy needs no manual migration step.
 */
export function openDatabase(file: string, migrationsFolder = './drizzle'): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });

  const sqlite = new Database(file);
  // WAL lets a reader and a writer coexist; without it a slow read can block a
  // write and Discord's 3-second interaction deadline is not generous.
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder });
  return db as Db;
}

export function readSwog(db: Db, guildId: string): SwogState {
  const row = db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1).get();
  if (!row) return NEVER_SWOGGED;
  return { swog: row.swog, since: row.since };
}

/**
 * Set swog for a guild. Returns whether THIS call changed it.
 *
 * The read and the write happen inside one transaction, so two people racing
 * `/swog` in the same server cannot both come away believing they flipped it --
 * exactly one gets `changed: true`. This is the whole reason the bot uses SQLite
 * instead of a JSON file: read-modify-write against a file silently loses one of
 * the two updates, and better-sqlite3 is synchronous, so the transaction is a
 * genuine critical section rather than a hopeful one.
 */
export function setSwog(db: Db, guildId: string, on: boolean): { changed: boolean; state: SwogState } {
  return db.transaction((tx): { changed: boolean; state: SwogState } => {
    const row = tx.select().from(guilds).where(eq(guilds.id, guildId)).limit(1).get();
    const current = row?.swog ?? false;

    if (current === on) {
      return { changed: false, state: { swog: current, since: row?.since ?? null } };
    }

    const since = new Date();
    tx.insert(guilds)
      .values({ id: guildId, swog: on, since })
      .onConflictDoUpdate({ target: guilds.id, set: { swog: on, since } })
      .run();

    return { changed: true, state: { swog: on, since } };
  });
}

/** Drop a guild's state when the bot is removed from it, so the table can't grow forever. */
export function forgetGuild(db: Db, guildId: string): void {
  db.delete(guilds).where(eq(guilds.id, guildId)).run();
}

export function closeDatabase(db: Db): void {
  db.$client.close();
}
