import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Swog state, one row per Discord server.
 *
 * Per-guild rather than global: the bot can be in many servers, and each one
 * swogs on its own terms. (The 2019 bot kept swog in a module-level `var`, so
 * it was global AND reset on every restart.)
 */
export const guilds = sqliteTable('guilds', {
  /** Discord guild snowflake. */
  id: text('id').primaryKey(),

  /** Is swog currently active in this guild? */
  swog: integer('swog', { mode: 'boolean' }).notNull().default(false),

  /** When swog last changed state -- powers the relative timestamp in /swog-status. */
  since: integer('since', { mode: 'timestamp_ms' }),
});

export type Guild = typeof guilds.$inferSelect;
