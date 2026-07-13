/**
 * The ONLY place in the codebase that reads process.env.
 *
 * Everything else takes config as an argument. That is what makes the bot
 * testable without a Discord account and without a .env file.
 */

export type Config = {
  readonly token: string;
  readonly clientId: string;
  /** When set, commands register to this guild only (instant). Unset = global. */
  readonly guildId: string | undefined;
  readonly databaseFile: string;
  readonly heartbeatFile: string;
  readonly logLevel: string;
  /** Chance a /swog attempt fails for comedy. 0..1. Set to 1 to test the branch. */
  readonly swogFailChance: number;
};

/** Discord snowflakes are 17-20 digit integers. */
const SNOWFLAKE = /^\d{17,20}$/;

export class ConfigError extends Error {
  constructor(problems: string[]) {
    super(
      [
        'Invalid configuration:',
        ...problems.map((p) => `  - ${p}`),
        '',
        'Copy .env.example to .env and fill it in. See the README.',
      ].join('\n'),
    );
    this.name = 'ConfigError';
  }
}

/**
 * Validate the environment and return a Config.
 *
 * Collects ALL problems and reports them at once -- being told about a missing
 * token, then re-running and being told about a missing client ID, is a bad
 * afternoon. Throws ConfigError; the caller prints .message and exits 1.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const problems: string[] = [];

  const token = env.DISCORD_TOKEN?.trim();
  if (!token) problems.push('DISCORD_TOKEN is required (Developer Portal -> Bot -> Reset Token)');

  const clientId = env.DISCORD_CLIENT_ID?.trim();
  if (!clientId) {
    problems.push('DISCORD_CLIENT_ID is required (Developer Portal -> General -> Application ID)');
  } else if (!SNOWFLAKE.test(clientId)) {
    problems.push(`DISCORD_CLIENT_ID must be a 17-20 digit snowflake, got "${clientId}"`);
  }

  const guildId = env.DISCORD_GUILD_ID?.trim() || undefined;
  if (guildId && !SNOWFLAKE.test(guildId)) {
    problems.push(`DISCORD_GUILD_ID must be a 17-20 digit snowflake, got "${guildId}"`);
  }

  const rawChance = env.SWOG_FAIL_CHANCE?.trim();
  let swogFailChance = 0.05;
  if (rawChance !== undefined && rawChance !== '') {
    const parsed = Number(rawChance);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
      problems.push(`SWOG_FAIL_CHANCE must be a number between 0 and 1, got "${rawChance}"`);
    } else {
      swogFailChance = parsed;
    }
  }

  if (problems.length > 0) throw new ConfigError(problems);

  const config: Config = {
    // Non-null assertions are safe: we pushed a problem and threw above if unset.
    token: token!,
    clientId: clientId!,
    guildId,
    databaseFile: env.DATABASE_FILE?.trim() || './data/swog.db',
    heartbeatFile: env.HEARTBEAT_FILE?.trim() || '/tmp/swog-heartbeat',
    logLevel: env.LOG_LEVEL?.trim() || 'info',
    swogFailChance,
  };

  // Make the token un-loggable. A stray `console.log(config)` or an error that
  // serializes its context should never be able to print it -- that is exactly
  // how this bot's token ended up on GitHub in 2022.
  //
  // BOTH hooks are required, and it is easy to think one is enough:
  //   - toJSON            covers JSON.stringify(config)
  //   - util.inspect.custom covers console.log(config) / util.inspect(config),
  //                       which do NOT call toJSON.
  // console.log is by far the likelier accident, so the inspect hook is the one
  // that actually earns its keep. (A test caught this file shipping only the
  // first of the two.)
  const redacted = () => ({ ...config, token: '***redacted***' });

  Object.defineProperty(config, 'toJSON', { enumerable: false, value: redacted });
  Object.defineProperty(config, Symbol.for('nodejs.util.inspect.custom'), {
    enumerable: false,
    value: redacted,
  });

  return Object.freeze(config);
}
