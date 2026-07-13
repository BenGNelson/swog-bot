#!/usr/bin/env bash
# ============================================================
# deploy.sh — ship the bot to the server.
#
#   ./scripts/deploy.sh      (or: make deploy, which runs the tests first)
#
# The server pulls from GitHub, so PUSH BEFORE YOU DEPLOY. The image is built on
# the server from that checkout — there is no registry.
#
# Config comes from .env (see .env.example). No hostname or path is hardcoded
# here: this file is committed to a public repo.
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERROR: .env not found. Copy .env.example to .env and fill it in."
  exit 1
fi

set -o allexport
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +o allexport

: "${DEPLOY_HOST:?Set DEPLOY_HOST in .env (ssh host or alias of the server)}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH in .env (the checkout on the server)}"
: "${DEPLOY_BRANCH:=main}"

echo "==> Deploying to ${DEPLOY_HOST}:${DEPLOY_PATH} (${DEPLOY_BRANCH})"

# Unquoted heredoc: local vars interpolate, remote-side vars are escaped (\$).
ssh -o StrictHostKeyChecking=accept-new "${DEPLOY_HOST}" bash -s << EOF
set -euo pipefail

if [ ! -d "${DEPLOY_PATH}/.git" ]; then
  echo "ERROR: ${DEPLOY_PATH} is not a git checkout. Provision it first — see DEPLOY.md."
  exit 1
fi

cd "${DEPLOY_PATH}"

# Never clobber work done directly on the server. If someone hot-patched
# something there, we want to know about it, not silently overwrite it.
if [ -n "\$(git status --porcelain)" ]; then
  echo "ERROR: ${DEPLOY_PATH} has uncommitted changes — refusing to deploy."
  git status --short
  exit 1
fi

echo "==> Pulling ${DEPLOY_BRANCH}"
git fetch origin
git checkout "${DEPLOY_BRANCH}"
git pull --ff-only origin "${DEPLOY_BRANCH}"

# .env lives on the server, is gitignored, and is never shipped from here. It
# survives every pull. If it's missing the bot cannot start, so fail loudly now
# rather than with a crash-loop in 30 seconds.
if [ ! -f .env ]; then
  echo "ERROR: no .env on the server at ${DEPLOY_PATH}/.env"
  echo "       Create it once, chmod 600, with the PROD bot token."
  exit 1
fi

echo "==> Building and restarting"
docker compose up --build -d bot

echo "==> Waiting for the bot to report healthy"
# The healthcheck is the real gate. \`docker compose up -d\` returns as soon as
# the container STARTS — a bot with a bad token is "started" and then dead. We
# wait for HEALTHY, which only happens once the gateway reaches READY.
for i in \$(seq 1 30); do
  status=\$(docker inspect --format '{{.State.Health.Status}}' swog-bot 2>/dev/null || echo "missing")
  if [ "\$status" = "healthy" ]; then
    echo "==> Healthy after \${i}0s"
    echo "==> Deployed \$(git rev-parse --short HEAD): \$(git log -1 --pretty=%s)"
    exit 0
  fi
  if [ "\$status" = "missing" ]; then
    echo "ERROR: container is not running."
    docker compose logs --no-color --tail 40 bot
    exit 1
  fi
  sleep 10
done

echo "ERROR: bot did not become healthy within 5 minutes. A deploy that leaves the"
echo "       bot down must fail, so: exiting non-zero."
docker compose logs --no-color --tail 40 bot
exit 1
EOF

echo "==> Done."
