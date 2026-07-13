import { describe, it, expect } from 'vitest';
import { buildRegistry, handleInteraction } from '../src/interactions.ts';
import { commands } from '../src/commands/index.ts';
import type { Command } from '../src/commands/types.ts';
import { fakeInteraction, testContext, testDb, contentOf } from './helpers.ts';

describe('interaction router', () => {
  it('routes by commandName, with no prefix', () => {
    const registry = buildRegistry(commands);

    // commandName is 'swog' -- never '!swog' or '$swog'. The 2022 handler compared
    // against a prefixed string, so it matched nothing and every command was a
    // silent no-op.
    expect(registry.has('swog')).toBe(true);
    expect(registry.has('!swog')).toBe(false);
    expect(registry.has('$swog')).toBe(false);
  });

  it('rejects duplicate command names instead of silently shadowing one', () => {
    const duplicated = [...commands, commands[0]!];
    expect(() => buildRegistry(duplicated)).toThrow(/duplicate/i);
  });

  it('answers politely for a command it does not know', async () => {
    const registry = buildRegistry(commands);
    const ctx = testContext({ db: testDb() });
    const { interaction, calls } = fakeInteraction({ commandName: 'ghost-command' });

    await handleInteraction(interaction, registry, ctx);

    expect(contentOf(calls[0]!)).toContain('no longer exists');
  });

  it('survives a command that throws, and still answers the user', async () => {
    // A throw inside a Discord event handler is an unhandled rejection, which by
    // default kills the process. One broken command must not take the bot offline.
    const exploding: Command = {
      data: commands[0]!.data,
      async execute() {
        throw new Error('boom');
      },
    };
    const registry = buildRegistry([exploding]);
    const ctx = testContext({ db: testDb() });
    const { interaction, calls } = fakeInteraction({ commandName: exploding.data.name });

    await expect(handleInteraction(interaction, registry, ctx)).resolves.toBeUndefined();

    expect(contentOf(calls[0]!)).toContain('Something went wrong');
  });

  it('does not double-reply when a command throws AFTER replying', async () => {
    // The nastiest version of the bug: the command replies, then throws. A naive
    // error handler calls reply() again -> InteractionAlreadyReplied -> the error
    // handler itself throws. Going through respond() makes the recovery a
    // followUp() instead.
    const halfBroken: Command = {
      data: commands[0]!.data,
      async execute(interaction) {
        await interaction.reply('partial work');
        throw new Error('boom after replying');
      },
    };
    const registry = buildRegistry([halfBroken]);
    const ctx = testContext({ db: testDb() });
    const { interaction, calls } = fakeInteraction({ commandName: halfBroken.data.name });

    await expect(handleInteraction(interaction, registry, ctx)).resolves.toBeUndefined();

    expect(calls.map((c) => c.type)).toEqual(['reply', 'followUp']);
    expect(contentOf(calls[1]!)).toContain('Something went wrong');
  });
});
