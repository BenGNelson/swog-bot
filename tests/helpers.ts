import { pino } from 'pino';
import type { ChatInputCommandInteraction } from 'discord.js';
import { openDatabase, type Db } from '../src/db/index.ts';
import type { CommandContext } from '../src/commands/types.ts';

/**
 * A fake ChatInputCommandInteraction.
 *
 * There is no usable Discord mocking library (the popular one was last published
 * in 2018), so we hand-roll the ~20 lines we actually need. That turns out to be
 * an advantage: we can make the fake ENFORCE Discord's rules, which a mock that
 * merely records calls would not.
 *
 * The important line is in reply(): calling it twice THROWS, exactly as the real
 * API does. That means the 2022 bug -- reply() followed by reply() -- is a test
 * failure here rather than a production outage.
 */
export type RecordedCall = { type: 'reply' | 'followUp'; payload: unknown };

export function fakeInteraction(options: {
  commandName: string;
  guildId?: string;
}): { interaction: ChatInputCommandInteraction; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];

  const interaction = {
    commandName: options.commandName,
    guildId: options.guildId ?? 'guild-1',
    replied: false,
    deferred: false,

    isChatInputCommand(): boolean {
      return true;
    },

    async reply(payload: unknown): Promise<void> {
      if (interaction.replied || interaction.deferred) {
        // This is what discord.js actually does. Do not soften it.
        throw new Error('InteractionAlreadyReplied: The reply to this interaction has already been sent.');
      }
      interaction.replied = true;
      calls.push({ type: 'reply', payload });
    },

    async followUp(payload: unknown): Promise<void> {
      if (!interaction.replied && !interaction.deferred) {
        throw new Error('Cannot follow up an interaction that has not been replied to.');
      }
      calls.push({ type: 'followUp', payload });
    },
  };

  return { interaction: interaction as unknown as ChatInputCommandInteraction, calls };
}

/** An in-memory database with migrations applied. No files, no cleanup. */
export function testDb(): Db {
  return openDatabase(':memory:', './drizzle');
}

export function testContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    db: overrides.db ?? testDb(),
    logger: overrides.logger ?? pino({ level: 'silent' }),
    // Default to never failing, so tests that don't care about the 5% branch are
    // deterministic. Tests that DO care inject their own.
    random: overrides.random ?? (() => 1),
    swogFailChance: overrides.swogFailChance ?? 0.05,
  };
}

/** The text of a recorded call, whether it was sent as a string or an options object. */
export function contentOf(call: RecordedCall): string {
  const payload = call.payload as { content?: string };
  return payload?.content ?? '';
}
