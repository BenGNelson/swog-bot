import { SlashCommandBuilder, InteractionContextType, EmbedBuilder, MessageFlags } from 'discord.js';
import { respond } from '../respond.ts';
import type { Command } from './types.ts';

export const swogHelp: Command = {
  data: new SlashCommandBuilder()
    .setName('swog-help')
    .setDescription('Show the swog commands')
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    // v14 takes `embeds: [EmbedBuilder]`. The 2019 bot passed `embed: { ... }`
    // (singular, a raw object), which was v11 syntax and silently sent nothing.
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('Swog Bot Options:')
      .addFields(
        {
          name: 'Command',
          value: '/swog\n/unswog\n/swog-status\n/swog-help',
          inline: true,
        },
        {
          name: 'Description',
          value:
            'Activates swog\nDeactivates swog\nChecks the swog status\nShows this message',
          inline: true,
        },
      )
      .setFooter({ text: 'Swog is swag + frog. Both good things.' });

    // Ephemeral: only the person who asked sees it. Help text is noise for
    // everyone else. (`flags` -- `{ ephemeral: true }` is deprecated.)
    await respond(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
