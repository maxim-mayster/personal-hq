#!/bin/sh
set -eu
TOKEN_FILE="/Users/maximfedorets/.config/aria/obsidian-rest-token"
if [ ! -f "$TOKEN_FILE" ]; then
  echo "ARIA Obsidian token file not found: $TOKEN_FILE" >&2
  exit 1
fi
TOKEN="$(/usr/bin/tr -d '\\r\\n' < "$TOKEN_FILE")"
if [ -z "$TOKEN" ]; then
  echo "Obsidian Local REST API API key is empty" >&2
  exit 1
fi
exec /usr/bin/env OBSIDIAN_API_URL="https://127.0.0.1:27124" OBSIDIAN_REST_TOKEN="$TOKEN" ARIA_BRIDGE_HOST="127.0.0.1" ARIA_BRIDGE_PORT="8766" ARIA_ALLOWED_ORIGIN="https://maxim-mayster.github.io" /usr/bin/python3 "/Users/maximfedorets/personal-hq-site/bridge/server.py"
