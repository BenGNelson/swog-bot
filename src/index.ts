import { DiscordAPIError } from 'discord.js';
import { loadConfig, ConfigError } from './config.ts';
import { createLogger } from './logger.ts';
import { openDatabase, closeDatabase } from './db/index.ts';
import { createClient } from './client.ts';
import type { CommandContext } from './commands/types.ts';

/** How long to wait for a graceful shutdown before pulling the plug. */
const SHUTDOWN_TIMEOUT_MS = 5_000;

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      // A readable sentence, not a stack trace. The old bot's failure mode was a
      // raw MODULE_NOT_FOUND on a missing config.json, which told you nothing.
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }

  const logger = createLogger(config.logLevel);
  const db = openDatabase(config.databaseFile);

  const ctx: CommandContext = {
    db,
    logger,
    random: Math.random,
    swogFailChance: config.swogFailChance,
  };

  const client = createClient(config, ctx);

  // --- Graceful shutdown ------------------------------------------------------
  // systemd and `docker stop` both send SIGTERM. Without a handler, Node's
  // default is to die instantly, mid-write. We close the gateway and the
  // database, in that order, so we stop accepting work before we drop the
  // ability to persist it.
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return; // a second Ctrl-C shouldn't re-enter this
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');

    // If the gateway socket hangs, don't hang with it -- Docker would SIGKILL us
    // after its grace period anyway, and we'd rather exit cleanly on our terms.
    const forceExit = setTimeout(() => {
      logger.error('shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
      await client.destroy(); // async in v14 -- must be awaited before closing the db
      closeDatabase(db);
      logger.info('shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'unhandled rejection');
  });

  // --- Log in -----------------------------------------------------------------
  try {
    await client.login(config.token);
  } catch (error) {
    // A 401 means the token is wrong. Exit immediately and do NOT retry.
    //
    // This matters more than it looks: Discord blocks an IP after 10,000 invalid
    // requests in 10 minutes. A bot that retries a bad token in a tight loop can
    // get its host's IP banned at the Cloudflare edge -- and this bot runs on a
    // home network, so that would take out the whole house, not just the bot.
    // Exiting lets Docker's restart backoff space the attempts out to ~1/minute.
    if (error instanceof DiscordAPIError && error.status === 401) {
      logger.fatal('Discord rejected the token (401). Check DISCORD_TOKEN. Not retrying.');
      process.exit(1);
    }
    logger.fatal({ err: error }, 'login failed');
    process.exit(1);
  }
}

await main();
