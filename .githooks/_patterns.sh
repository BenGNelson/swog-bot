# Sourced by the git hooks and by scripts/check-secrets.sh. Builds $FORBIDDEN —
# a regex alternation of the LITERAL values this repo must never contain
# (hostnames, LAN IPs, server paths, names).
#
# The values live in the gitignored .githooks/patterns.local (one POSIX extended
# regex per line; only lines STARTING with "#" are comments — a trailing comment
# would be parsed as part of the regex and silently disable the pattern).
#
# This indirection is the point: a scanner that hardcodes the literals it forbids
# publishes them. Shapes (token formats, private IP ranges) are a different thing
# — they describe a form, not a value — and live in scripts/check-secrets.sh.
_hooks_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORBIDDEN=""
_pat_file="$_hooks_dir/patterns.local"
if [ -f "$_pat_file" ]; then
  while IFS= read -r _line || [ -n "$_line" ]; do
    case "$_line" in '' | \#*) continue ;; esac
    if [ -z "$FORBIDDEN" ]; then
      FORBIDDEN="$_line"
    else
      FORBIDDEN="$FORBIDDEN|$_line"
    fi
  done < "$_pat_file"
fi
