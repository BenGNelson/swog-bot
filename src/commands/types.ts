import type { ChatInputCommandInteraction, SlashCommandOptionsOnlyBuilder, SlashCommandBuilder } from 'discord.js';
import type { Logger } from 'pino';
import type { Db } from '../db/index.ts';

/**
 * Everything a command is allowed to touch, handed in explicitly.
 *
 * Commands import NO globals -- no module-level db, no module-level RNG. That is
 * what lets the tests drive a command with an in-memory database and a rigged
 * `random`, and it is why the 5% failure branch is deterministically testable
 * instead of something you hope to hit.
 */
export type CommandContext = {
  readonly db: Db;
  readonly logger: Logger;
  /** Injectable so tests can force the outcome. Defaults to Math.random. */
  readonly random: () => number;
  readonly swogFailChance: number;
};

export type Command = {
  readonly data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
  execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void>;
};
