import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import { setSwog, readSwog } from '../db/index.ts';
import { respond } from '../respond.ts';
import type { Command } from './types.ts';

export const swog: Command = {
  data: new SlashCommandBuilder()
    .setName('swog')
    .setDescription('Activate swog')
    // Guild-only. This is the modern replacement for setDMPermission(false),
    // which is deprecated in v14 and REMOVED in v15. It also means we never have
    // to handle a null guildId: Discord simply won't offer the command in DMs.
    .setContexts(InteractionContextType.Guild),

  async execute(interaction, { db, random, swogFailChance }) {
    const guildId = interaction.guildId!; // guaranteed by setContexts(Guild)

    if (readSwog(db, guildId).swog) {
      await respond(interaction, 'Swog is already activated.');
      return;
    }

    // The 2019 bot's best feature: swogging sometimes just doesn't take.
    if (random() < swogFailChance) {
      await respond(interaction, 'Swog unsuccessful. Please swog harder.');
      return;
    }

    // Atomic. If someone else swogged in the microseconds since our read above,
    // `changed` comes back false and we tell the truth instead of double-claiming.
    const { changed } = setSwog(db, guildId, true);
    if (!changed) {
      await respond(interaction, 'Swog is already activated.');
      return;
    }

    await respond(interaction, 'Swog activated.');
    await respond(interaction, 'Swog'); // becomes a followUp() -- see respond.ts
  },
};
