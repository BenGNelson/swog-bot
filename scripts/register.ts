/**
 * Push the slash-command definitions to Discord.
 *
 * Run this ONCE after changing the command list -- not on every boot.
 *
 * Registering on startup is a common anti-pattern: Discord allows only 200
 * command creations per day per guild, so a crash-looping bot will exhaust the
 * quota and lock you out of fixing it. The official guide says the same. Keep it
 * a deliberate, separate action.
 *
 *   npm run register              # DISCORD_GUILD_ID set -> that guild, INSTANT
 *   npm run register              # unset               -> global
 *   npm run register -- --clear   # remove all commands (both scopes)
 *
 * Guild-scoped registration appears immediately, which is what you want while
 * developing. Global registration is what you want in production.
 */
import { REST, Routes } from 'discord.js';
import { loadConfig, ConfigError } from '../src/config.ts';
import { commands } from '../src/commands/index.ts';

let config;
try {
  config = loadConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

const clear = process.argv.includes('--clear');
const body = clear ? [] : commands.map((command) => command.data.toJSON());

const rest = new REST({ version: '10' }).setToken(config.token);

const route = config.guildId
  ? Routes.applicationGuildCommands(config.clientId, config.guildId)
  : Routes.applicationCommands(config.clientId);

const scope = config.guildId ? `guild ${config.guildId} (instant)` : 'global';

try {
  console.log(`${clear ? 'Clearing' : 'Registering'} ${body.length} command(s) -> ${scope}`);
  const result = (await rest.put(route, { body })) as unknown[];
  console.log(`Done. Discord now has ${result.length} command(s) in scope.`);
  for (const command of body) console.log(`  /${command.name}`);
} catch (error) {
  console.error('Registration failed.');
  // rawError carries the ACTUAL problem. A bare `console.error(error)` prints
  // "DiscordAPIError[50035]: Invalid Form Body" and nothing else -- whereas
  // rawError tells you *which command* and *which field*, e.g.
  //   name: must match ^[-_\p{L}\p{N}]{1,32}$
  // The 2022 version of this script logged the bare error, which is a large part
  // of why the illegal '$swog' names were never diagnosed.
  const raw = (error as { rawError?: unknown }).rawError;
  console.error(raw ? JSON.stringify(raw, null, 2) : error);
  process.exit(1);
}
