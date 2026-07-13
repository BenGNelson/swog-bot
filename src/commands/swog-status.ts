import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import { readSwog } from '../db/index.ts';
import { respond } from '../respond.ts';
import type { Command } from './types.ts';

export const swogStatus: Command = {
  data: new SlashCommandBuilder()
    .setName('swog-status')
    .setDescription('Check the swog status')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction, { db }) {
    const { swog, since } = readSwog(db, interaction.guildId!);

    if (!swog) {
      await respond(interaction, 'Swog is not active. Type /swog to activate swog.');
      return;
    }

    // <t:unix:R> is Discord's relative-timestamp markup -- it renders as
    // "3 hours ago" in each viewer's own locale and timezone. Doing this
    // client-side is strictly better than formatting a date ourselves.
    const suffix = since ? ` (since <t:${Math.floor(since.getTime() / 1000)}:R>)` : '';
    await respond(interaction, `Swog is active.${suffix}`);
  },
};
