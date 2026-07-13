#!/usr/bin/env bash
# ============================================================
# test.sh — everything that must be green before a deploy.
#
# Runs in Docker, not on your host. That is deliberate: the container is the
# thing we ship, so testing anywhere else tests something we don't ship. It also
# means you need no Node, no npm, and no toolchain on your laptop.
#
#   ./scripts/test.sh          # typecheck + unit tests + secret scan
#   make test
# ============================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

# Must match the Dockerfile, or you are testing a different runtime than you ship.
NODE_IMAGE="node:24-alpine"

PASS=0
FAIL=0
head() { printf '\n\033[1m%s\033[0m\n' "$1"; }
pass() { printf '  \033[32m✓\033[0m %s\n' "$1"; PASS=$((PASS + 1)); }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; FAIL=$((FAIL + 1)); }

# Runs a command in the pinned Node image and returns ITS exit status.
#
# The obvious version of this pipes through `grep -v` to drop npm's notices --
# and is wrong: grep exits 1 when it filters out every line, so a command that
# succeeds silently (like a clean `tsc --noEmit`) is reported as a failure. Keep
# the exit status of the docker run itself, and filter the captured text after.
run_in_node() {
  local raw status
  raw=$(docker run --rm -v "${ROOT}":/app -w /app "${NODE_IMAGE}" sh -c "$1" 2>&1)
  status=$?
  printf '%s\n' "${raw}" | grep -vE '^npm notice' || true
  return "${status}"
}

# ── Dependencies ──────────────────────────────────────────────────────────────
head "Dependencies"
if [[ -d node_modules ]]; then
  pass "node_modules present"
else
  printf '  installing (first run)...\n'
  if run_in_node 'npm ci --no-audit --no-fund' >/dev/null; then
    pass "npm ci"
  else
    fail "npm ci"
  fi
fi

# ── Typecheck ─────────────────────────────────────────────────────────────────
# LOAD-BEARING. Node strips types without checking them, so TypeScript buys us
# nothing at runtime — this is the only thing standing between a type error and
# a production crash. Never skip it.
head "Typecheck (tsc --noEmit)"
if output=$(run_in_node 'npx tsc --noEmit'); then
  pass "no type errors"
else
  fail "type errors:"
  echo "${output}" | sed 's/^/      /'
fi

# ── Unit tests ────────────────────────────────────────────────────────────────
head "Unit tests (vitest)"
if output=$(run_in_node 'npx vitest run --reporter=dot'); then
  pass "$(echo "${output}" | grep -oE '[0-9]+ passed' | tail -1 || echo 'all tests passed')"
else
  fail "test failures:"
  echo "${output}" | tail -25 | sed 's/^/      /'
fi

# ── Docker build ──────────────────────────────────────────────────────────────
# A green test suite and a broken Dockerfile still means a broken deploy.
head "Docker build"
if docker build -q -t swog-bot:test . >/dev/null 2>&1; then
  pass "image builds"
else
  fail "docker build failed"
fi

# ── Secrets ───────────────────────────────────────────────────────────────────
head "Secret / PII scan"
if ./scripts/check-secrets.sh >/dev/null 2>&1; then
  pass "check-secrets: clean"
else
  fail "check-secrets found something:"
  ./scripts/check-secrets.sh 2>&1 | sed 's/^/      /'
fi

# ── Result ────────────────────────────────────────────────────────────────────
printf '\n\033[1mResult:\033[0m %d passed, %d failed\n\n' "${PASS}" "${FAIL}"
[[ "${FAIL}" -eq 0 ]]
