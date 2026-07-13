import { writeFileSync } from 'node:fs';
import { Client, Events, GatewayIntentBits, ActivityType, Status } from 'discord.js';
import { commands } from './commands/index.ts';
import { buildRegistry, handleInteraction } from './interactions.ts';
import { forgetGuild } from './db/index.ts';
import type { CommandContext } from './commands/types.ts';
import type { Config } from './config.ts';

/** How often to touch the heartbeat file. The Docker HEALTHCHECK allows 3x this. */
const HEARTBEAT_INTERVAL_MS = 30_000;

export function createClient(config: Config, ctx: CommandContext): Client {
  const client = new Client({
    // A slash-command bot needs NO privileged intents. Interactions arrive over
    // the interaction gateway regardless of intents -- `intents: []` would even
    // work. We ask for Guilds (non-privileged, free) only so that interaction
    // data resolves to full objects instead of bare IDs, and so guildDelete
    // fires and we can clean up state.
    //
    // Do NOT add MessageContent. It is privileged, requires portal approval and
    // verification at 100 servers, and a slash bot has no use for it. Reading
    // message.content is what the 2019 bot did, and Discord making that intent
    // privileged in September 2022 is precisely why it went silent.
    intents: [GatewayIntentBits.Guilds],
  });

  const registry = buildRegistry(commands);

  // Use the Events enum, never string literals: 'ready' is being renamed to
  // 'clientReady', and the enum keeps us correct across that change.
  client.once(Events.ClientReady, (ready) => {
    ctx.logger.info(
      { tag: ready.user.tag, guilds: ready.guilds.cache.size },
      'swog-bot ready',
    );
    ready.user.setActivity('Swog: The Game', { type: ActivityType.Playing });
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction, registry, ctx);
  });

  // Kicked from a server? Forget it, so the table doesn't accumulate rows for
  // guilds we'll never serve again.
  client.on(Events.GuildDelete, (guild) => {
    ctx.logger.info({ guildId: guild.id }, 'removed from guild, dropping its swog state');
    forgetGuild(ctx.db, guild.id);
  });

  // discord.js reconnects on its own. Log and carry on -- do NOT exit here, or a
  // transient network blip becomes a restart loop.
  client.on(Events.Error, (error) => ctx.logger.error({ err: error }, 'gateway error'));
  client.on(Events.Warn, (message) => ctx.logger.warn({ message }, 'gateway warning'));

  // Liveness for Docker. A bot listens on no port, so there is nothing to curl.
  // Instead we touch a file while the gateway is actually READY, and the
  // HEALTHCHECK asserts it is fresh. This detects a wedged websocket -- a plain
  // process check would call a bot that silently stopped receiving events
  // "healthy", which is the failure mode we actually care about.
  const beat = () => {
    if (client.ws.status === Status.Ready) {
      try {
        writeFileSync(config.heartbeatFile, String(Date.now()));
      } catch (error) {
        ctx.logger.warn({ err: error }, 'could not write heartbeat file');
      }
    }
  };
  const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
  timer.unref(); // never keep the process alive just for the heartbeat
  client.once(Events.ClientReady, beat);

  return client;
}
