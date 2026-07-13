import { MessageFlags, type ChatInputCommandInteraction, type Interaction } from 'discord.js';
import { respond } from './respond.ts';
import type { Command, CommandContext } from './commands/types.ts';

/** Build a name -> command lookup. Throws on duplicate names rather than shadowing one. */
export function buildRegistry(commands: readonly Command[]): Map<string, Command> {
  const registry = new Map<string, Command>();
  for (const command of commands) {
    const name = command.data.name;
    if (registry.has(name)) throw new Error(`Duplicate command name: ${name}`);
    registry.set(name, command);
  }
  return registry;
}

/**
 * Route one interaction to its command, with an error boundary around it.
 *
 * A throw inside a Discord event handler is an unhandled promise rejection --
 * which, by default, kills the process. One malformed command should not take
 * the bot offline, so every execute() runs inside try/catch.
 */
export async function handleInteraction(
  interaction: Interaction,
  registry: Map<string, Command>,
  ctx: CommandContext,
): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const command = registry.get(interaction.commandName);
  if (!command) {
    // Usually means a command was removed from the code but is still registered
    // with Discord. Tell the user something, and leave a breadcrumb for us.
    ctx.logger.warn({ commandName: interaction.commandName }, 'unknown command');
    await respond(interaction, {
      content: 'That command no longer exists.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await command.execute(interaction as ChatInputCommandInteraction, ctx);
  } catch (error) {
    ctx.logger.error(
      { err: error, commandName: interaction.commandName, guildId: interaction.guildId },
      'command failed',
    );

    // respond() (not reply()) is load-bearing here. The command may already have
    // replied before it threw, in which case reply() would throw again -- and an
    // error handler that throws is how a bot goes from "one broken command" to
    // "process is dead".
    try {
      await respond(interaction, {
        content: 'Something went wrong. The swog remains uncertain.',
        flags: MessageFlags.Ephemeral,
      });
    } catch (replyError) {
      ctx.logger.error({ err: replyError }, 'failed to report the failure');
    }
  }
}
