/**
 * Docker HEALTHCHECK probe.
 *
 * A Discord bot listens on no port, so there is nothing to curl. Instead the
 * client touches a heartbeat file every 30s *while the gateway is READY*, and
 * this asserts the file is fresh.
 *
 * The distinction matters: a plain "is the process alive?" check happily reports
 * a bot that is running but silently disconnected from Discord as healthy. That
 * is the exact failure we want to catch.
 *
 * Exit 0 = healthy, 1 = unhealthy.
 */
import { statSync } from 'node:fs';

const STALE_AFTER_MS = 90_000; // 3 missed heartbeats

const file = process.env.HEARTBEAT_FILE?.trim() || '/tmp/swog-heartbeat';

try {
  const age = Date.now() - statSync(file).mtimeMs;
  if (age > STALE_AFTER_MS) {
    console.error(`heartbeat is ${Math.round(age / 1000)}s stale (max ${STALE_AFTER_MS / 1000}s)`);
    process.exit(1);
  }
  process.exit(0);
} catch {
  console.error(`no heartbeat file at ${file} -- bot has not reached READY`);
  process.exit(1);
}
