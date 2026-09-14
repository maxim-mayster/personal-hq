# ARIA Obsidian Bridge

This local companion keeps the Obsidian Local REST API token off GitHub Pages and provides the missing persistent integration boundary.

## Start

1. Install and enable Obsidian's Local REST API plugin.
2. For manual development, start the bridge with the token in the process environment:

```sh
OBSIDIAN_REST_TOKEN='your-local-plugin-token' OBSIDIAN_API_URL='https://127.0.0.1:27124' python3 bridge/server.py
```

Optional variables:

- `OBSIDIAN_API_URL` (default `https://127.0.0.1:27124`)
- `ARIA_BRIDGE_PORT` (default `8766`)

On the configured Mac, `bridge/start.sh` reads the protected local token file and
the LaunchAgent `com.maxim.aria-obsidian-bridge` keeps the service running at
login. The public HQ never receives the token.

The bridge exposes:

- `GET /health` — connector status, never the token
- `GET /vault/...` — authenticated Obsidian read proxy used by the HQ
- `POST /api/memory` — validated Markdown write-back to Obsidian

The token stays in the bridge process and is never sent to the browser. Write paths must be Markdown files, cannot traverse outside the vault, and are sent through the authenticated Obsidian API.

## Test

```sh
python3 -m unittest discover -s bridge -p 'test_*.py'
```

This is the local connector foundation. The next integration step is to make the HQ use `/health` and `/api/memory` for automatic read/write memory workflows instead of the current manual read-only snapshot wording.
