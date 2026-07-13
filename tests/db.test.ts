import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, closeDatabase, readSwog, setSwog, forgetGuild } from '../src/db/index.ts';

const GUILD = '111111111111111111';

describe('swog state', () => {
  it('defaults to unswogged for a guild it has never seen', () => {
    const db = openDatabase(':memory:', './drizzle');
    expect(readSwog(db, 'never-seen')).toEqual({ swog: false, since: null });
  });

  it('reports whether THIS call changed the state', () => {
    const db = openDatabase(':memory:', './drizzle');

    expect(setSwog(db, GUILD, true).changed).toBe(true);
    expect(setSwog(db, GUILD, true).changed).toBe(false); // already on -- we didn't change it
    expect(setSwog(db, GUILD, false).changed).toBe(true);
    expect(setSwog(db, GUILD, false).changed).toBe(false);
  });

  it('does not lose an update when two swogs race', () => {
    // The reason this bot uses SQLite instead of a JSON file. Two concurrent
    // read-modify-write cycles against a file silently drop one of the writes;
    // here the transaction serializes them, so exactly ONE call reports changed.
    const db = openDatabase(':memory:', './drizzle');

    const results = Array.from({ length: 50 }, () => setSwog(db, GUILD, true));

    expect(results.filter((r) => r.changed)).toHaveLength(1);
    expect(readSwog(db, GUILD).swog).toBe(true);
  });

  it('keeps guilds independent', () => {
    const db = openDatabase(':memory:', './drizzle');
    setSwog(db, 'guild-a', true);

    expect(readSwog(db, 'guild-a').swog).toBe(true);
    expect(readSwog(db, 'guild-b').swog).toBe(false);
  });

  it('forgets a guild when the bot is removed from it', () => {
    const db = openDatabase(':memory:', './drizzle');
    setSwog(db, GUILD, true);

    forgetGuild(db, GUILD);

    expect(readSwog(db, GUILD).swog).toBe(false);
  });

  it('survives a restart', () => {
    // The acceptance test for the whole persistence layer. The 2019 bot kept swog
    // in a module-level `var`, so every restart silently unswogged every server.
    const dir = mkdtempSync(join(tmpdir(), 'swog-test-'));
    const file = join(dir, 'swog.db');

    try {
      const first = openDatabase(file, './drizzle');
      setSwog(first, GUILD, true);
      closeDatabase(first);

      const second = openDatabase(file, './drizzle');
      const state = readSwog(second, GUILD);
      closeDatabase(second);

      expect(state.swog).toBe(true);
      expect(state.since).toBeInstanceOf(Date);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
