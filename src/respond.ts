import type { ChatInputCommandInteraction, InteractionReplyOptions } from 'discord.js';

/**
 * Send a message for an interaction. Use this instead of interaction.reply().
 *
 * WHY THIS EXISTS -- this is the bug that broke the bot in 2022:
 *
 *     await interaction.reply('Swog activated.');
 *     await interaction.reply('Swog');            // <-- throws InteractionAlreadyReplied
 *
 * An interaction can be *replied to* exactly once. Every message after the first
 * must be a followUp(). Calling reply() twice throws, and because it throws
 * inside an async event handler, it takes the whole command down with it.
 *
 * Routing every message through here means a command author cannot make that
 * mistake: the first call replies, and any subsequent call automatically becomes
 * a follow-up. The original bot's two-message flourish ("Swog activated." then
 * "Swog") survives; the crash does not.
 *
 * This also protects the error path in interactions.ts, which is where naive
 * bots die -- the error handler tries to reply(), the interaction was already
 * replied to, and the error handler throws its own error.
 */
export async function respond(
  interaction: ChatInputCommandInteraction,
  payload: string | InteractionReplyOptions,
): Promise<void> {
  const options: InteractionReplyOptions =
    typeof payload === 'string' ? { content: payload } : payload;

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(options);
    return;
  }
  await interaction.reply(options);
}
