import { describe, it, expect } from 'vitest';
import { commands } from '../src/commands/index.ts';
import { buildRegistry } from '../src/interactions.ts';

/**
 * Structural tests: assertions about the SHAPE of the command list, not its behavior.
 *
 * These are the highest-value tests in a Discord bot, because the failures they
 * catch are the ones that take a bot down at deploy time with an opaque
 * "Invalid Form Body" and no stack trace. This file would have caught the 2022
 * outage on the first run.
 */

// Discord's actual rule for slash-command names. Lowercase, 1-32 chars, letters
// and numbers (any language), dash and underscore. Notably: NO spaces, NO '$'.
const VALID_NAME = /^[-_\p{L}\p{N}]{1,32}$/u;

describe('command definitions', () => {
  it('has commands', () => {
    expect(commands.length).toBeGreaterThan(0);
  });

  it.each(commands.map((c) => [c.data.name, c] as const))(
    '/%s has a legal name',
    (name) => {
      // The 2022 bot registered '$swog', '$unswog', '$swog status', '$swog help'.
      // Every one of those fails this assertion. Discord rejected the whole
      // registration with a 400, so no command was ever created.
      expect(name).toMatch(VALID_NAME);
      expect(name).toBe(name.toLowerCase());
      expect(name).not.toContain(' ');
    },
  );

  it.each(commands.map((c) => [c.data.name, c] as const))(
    '/%s has a valid description',
    (_name, command) => {
      const description = command.data.description;
      expect(description.length).toBeGreaterThan(0);
      expect(description.length).toBeLessThanOrEqual(100);
    },
  );

  it.each(commands.map((c) => [c.data.name, c] as const))(
    '/%s serializes for the Discord API',
    (_name, command) => {
      // toJSON() is what actually gets PUT to Discord. If a builder is misused,
      // this is where it surfaces -- locally, in a test, instead of at deploy.
      expect(() => command.data.toJSON()).not.toThrow();
    },
  );

  it.each(commands.map((c) => [c.data.name, c] as const))(
    '/%s is guild-only',
    (_name, command) => {
      // setContexts(Guild) is why no command has to handle a null guildId.
      // If someone drops it, the guildId! non-null assertions become lies.
      const json = command.data.toJSON() as { contexts?: number[] };
      expect(json.contexts).toEqual([0]); // 0 = InteractionContextType.Guild
    },
  );

  it('has no duplicate names', () => {
    const names = commands.map((c) => c.data.name);
    expect(new Set(names).size).toBe(names.length);
    expect(() => buildRegistry(commands)).not.toThrow();
  });

  it('is within the 100-command limit Discord allows per application', () => {
    expect(commands.length).toBeLessThanOrEqual(100);
  });

  it('every command exposes an execute function', () => {
    for (const command of commands) {
      expect(typeof command.execute).toBe('function');
    }
  });
});
