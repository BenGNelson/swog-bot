import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
import { setSwog } from '../db/index.ts';
import { respond } from '../respond.ts';
import type { Command } from './types.ts';

export const unswog: Command = {
  data: new SlashCommandBuilder()
    .setName('unswog')
    .setDescription('Deactivate swog')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction, { db }) {
    const guildId = interaction.guildId!;

    // No read-then-write here: setSwog is atomic and tells us whether it was the
    // one that flipped it, which is exactly the question we need answered.
    const { changed } = setSwog(db, guildId, false);

    await respond(
      interaction,
      changed ? 'Swog deactivated.' : 'Swog is already deactivated.',
    );
  },
};
