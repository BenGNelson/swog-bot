#!/usr/bin/env bash
# ============================================================
# check-secrets.sh — fail if a secret or personal identifier would be committed.
#
# Two pattern sources, split by KIND. The split IS the design:
#
#   1. SHAPES (below, committed). Regexes describing a FORM, not a value: the
#      Discord token format, webhook URLs, private IP ranges, key headers.
#      Publishing these reveals nothing.
#
#   2. LITERALS (.githooks/patterns.local, GITIGNORED). Actual hostnames, IPs,
#      paths, names. Loaded via .githooks/_patterns.sh.
#
#   Do NOT put a literal in this file. A scanner that hardcodes the values it
#   forbids *publishes* them — this repo's sibling did exactly that, passing
#   every run while leaking the list in a public repo.
#
# Scans the working-tree content of files git tracks/stages, so .gitignore does
# the excluding for free (.env and *.local are never scanned).
#
# Usage:  ./scripts/check-secrets.sh   (0 = clean, 1 = leak)
# ============================================================
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

# ── Shape patterns: safe to publish ───────────────────────────────────────────
SHAPES=(
  # A Discord bot token: base64(app_id).timestamp.hmac — three dot-separated
  # segments. This is the single most important line in the file. In 2022 a live
  # token was committed to this very repo in config.json.
  '\b[MNO][A-Za-z0-9_-]{22,26}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}\b'
  '\bmfa\.[A-Za-z0-9_-]{20,}\b'

  # Discord webhook URLs carry their own auth.
  'discord(app)?\.com/api/(v[0-9]+/)?webhooks/[0-9]{17,20}/[A-Za-z0-9_-]{60,}'

  # A token/secret with a real value assigned. Catches a resurrected config.json
  # and a .env that slipped past .gitignore.
  '(DISCORD_)?(TOKEN|CLIENT_SECRET)[[:space:]]*[:=][[:space:]]*['"'"'"]?[A-Za-z0-9._-]{20,}'
  '"token"[[:space:]]*:[[:space:]]*"[A-Za-z0-9._-]{20,}"'

  # Keys and cloud creds.
  '-----BEGIN (RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----'
  '\bAKIA[0-9A-Z]{16}\b'
  '\bgh[pousr]_[A-Za-z0-9]{36,}\b'

  # Private IPv4 — a home-network address in a public repo maps your LAN.
  '\b(10|127)\.[0-9]+\.[0-9]+\.[0-9]+\b'
  '\b192\.168\.[0-9]+\.[0-9]+\b'
  '\b172\.(1[6-9]|2[0-9]|3[01])\.[0-9]+\.[0-9]+\b'
  '\b100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.[0-9]+\.[0-9]+\b'
)

# NOTE on snowflakes: a raw \b[0-9]{17,20}\b rule would be tempting here (client
# IDs, guild IDs). It is omitted on purpose — it false-positives on lockfile
# integrity hashes and timestamps, and a client ID is public by design (it is in
# every invite URL). Guild IDs that must stay private belong in patterns.local.

# ── Literal patterns: from the gitignored file ────────────────────────────────
# shellcheck source=/dev/null
. "${ROOT}/.githooks/_patterns.sh"

if [[ -z "${FORBIDDEN:-}" ]]; then
  echo "⚠️  check-secrets: .githooks/patterns.local not found — SHAPE checks only."
  echo "    Host literals (hostnames, LAN IPs, names) are NOT being enforced."
  echo "    cp .githooks/patterns.local.example .githooks/patterns.local"
  echo ""
fi

PATTERNS=("${SHAPES[@]}")
[[ -n "${FORBIDDEN:-}" ]] && PATTERNS+=("${FORBIDDEN}")

# git ls-files -z | xargs -0 works on macOS bash 3.2 (no mapfile) and on paths
# with spaces. -I skips binaries. Exclude .githooks/ (patterns.local legitimately
# contains every literal) and this script (it legitimately contains every shape).
FOUND=0
for pat in "${PATTERNS[@]}"; do
  hits=$(git ls-files -z -- ':!:.githooks/' ':!:scripts/check-secrets.sh' \
    | xargs -0 grep -IniE "${pat}" 2>/dev/null)
  if [[ -n "${hits}" ]]; then
    echo "❌ Forbidden pattern found:"
    echo "${hits}" | sed 's/^/    /'
    FOUND=1
  fi
done

if [[ "${FOUND}" -eq 0 ]]; then
  echo "✅ check-secrets: clean."
  exit 0
fi
echo ""
echo "check-secrets FAILED. Scrub the above (or gitignore the file) before committing."
exit 1
