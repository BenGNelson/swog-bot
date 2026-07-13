import { pino, type Logger } from 'pino';

/**
 * Structured JSON logs to stdout. Nothing else.
 *
 * The container captures stdout (docker compose caps it -- see the x-logging
 * anchor in docker-compose.yml, because Docker's default json-file driver grows
 * without bound). Do not add file transports or log rotation here; that is the
 * platform's job, not the app's.
 */
export function createLogger(level: string): Logger {
  return pino({
    level,
    // Redact anything token-shaped that sneaks into a log context. Belt and
    // braces -- config.ts already makes the token un-serializable.
    redact: {
      paths: ['token', '*.token', 'config.token', 'err.config.token'],
      censor: '***redacted***',
    },
  });
}

export type { Logger };
