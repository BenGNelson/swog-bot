# Pinned by tag AND digest. Not `node:alpine` and not even a floating `node:24-alpine`:
# better-sqlite3 ships prebuilt native binaries per Node ABI, and drifting onto an
# unexpected Node major silently falls back to compiling from source inside the
# image (slow, and needs a toolchain we don't install). Pin it, and bump it on purpose.
FROM node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd

WORKDIR /app

# Dependencies before source, so editing a .ts file doesn't invalidate the npm layer.
# `npm ci` (not `npm install`) installs the lockfile exactly and fails on drift.
# `--omit=dev` keeps typescript/vitest/drizzle-kit out of the runtime image.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# No build step. Node runs the TypeScript directly via native type stripping, so
# what ships is the source you wrote -- no dist/, no sourcemaps, no bundler.
COPY src/ ./src/
COPY drizzle/ ./drizzle/
COPY scripts/ ./scripts/

# Run as a non-root user. `node` already exists in the base image (uid 1000).
# /data is the SQLite volume; it must be writable by that user.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

ENV NODE_ENV=production \
    DATABASE_FILE=/data/swog.db \
    HEARTBEAT_FILE=/tmp/swog-heartbeat

# The bot has no port, so health is "is the gateway actually READY?" -- see
# src/healthcheck.ts. start-period gives it room to connect before the first probe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "src/healthcheck.ts"]

CMD ["node", "src/index.ts"]
