# ARIA Personal HQ — operations and verification

## Product boundary

Keep `index.html` as the single-file application. Preserve Command Center, Agent Floor, The Vault, Mission Control, Analytics Deck, Identity & Settings, and the shared Comms Terminal. The optional 3D graph belongs only inside The Vault. Do not replace this shell with a framework dashboard.

This is a live-data-only workspace. It starts disconnected and renders no records, metrics, agent activity, schedules or memory content until an authenticated connector returns them. Comms is unavailable until a live agent connection exists. No browser-local task creation or role selection dispatches work. The local `bridge/server.py` companion is the intended Obsidian connector boundary.

## Local development

Requirements: Node.js, Python 3, npm.

```sh
npm ci
./node_modules/.bin/playwright install chromium
python3 -m http.server 8765 --bind 127.0.0.1
```

Open http://127.0.0.1:8765/. The app has no build step; npm dependencies are development-only.

```sh
npm run check
npm test
node scripts/audit.mjs candidate
```

`check` extracts inline JavaScript and runs Node's syntax checker, then checks static HTML IDs. Playwright covers browser interactions. The audit captures each original section at desktop, tablet and mobile widths and records axe accessibility findings and browser errors. Inspect the screenshots, not just the exit status. Evidence lives in ignored `qa-output/` and `test-results/` directories.

## State and privacy

- `aria.hq.v1` in localStorage contains local tasks, mission and presentation preferences. It is per browser/origin, not cloud synchronization or authentication. Other scripts on the same origin can access it; do not put secrets in tasks.
- Disable Remember local changes to clear the saved workspace and continue session-only. Clearing browser storage erases saved local work.
- Activity and Comms history are tab-local and bounded.
- Obsidian note excerpts and plugin tokens are not intentionally persisted. Tokens are cleared from the input when a read begins. Never commit tokens, vault exports, personal notes, browser state or test artifacts.
- External graph dependencies are optional; dependency failure must leave the HQ usable with an accessible memory list.

## Obsidian boundary

`HQData.build(rows, source)` is the pure data/layout seam. Rows use `{id, title, type, content, links, tag, path}`. IDs identify paths, not merely basenames. Edges are deduplicated without losing reverse-alphabetical links; unresolved links remain explicit.

`HQObsidian` can read through the local ARIA bridge at `http://127.0.0.1:8766`, which keeps the Obsidian token out of the browser and public Pages build. The bridge proxies bounded vault reads and exposes a validated `POST /api/memory` write path for future durable ARIA memory capture. Direct browser-to-plugin mode remains optional and read-only. Only HTTP(S) loopback origins are allowed for direct mode; redirects and ambient credentials are disallowed. Reads are bounded by time, request count, note/folder count and response size. Failed reads preserve the previous dataset. There is no embedded fallback dataset.

GitHub Pages HTTPS may be unable to reach a local plugin because of browser local-network policy, CORS or certificates. Do not weaken browser security or invent a successful sync. No live Obsidian connectivity is claimed until an actual connector response is verified; intercepted test responses are fixtures, not backend evidence.

The bridge write path requires its local Obsidian token, validates Markdown paths, rejects traversal and records no token in the site. Before exposing automatic write-back to ARIA behavior, add explicit user confirmation, conflict detection and an audit trail. Never embed a cloud/model API key in this static site.

## Local Comms workflow

- `/help`: available commands and limitations.
- `/status`: local task/memory counts and focus.
- `/find <words>`: search note titles, tags and excerpts with clickable results.
- `/context`: show stored selected/focused note text and resolved context; detailed replies add two-hop context.
- `/focus <exact title>`: set operator planning focus, without executing an agent.
- `/task <title>`: unavailable until a live task connector is connected.
- `/clear`: clear the tab conversation.

Keyboard: native Tab/Enter/Space controls, Escape to close dialogs/inspectors, Cmd/Ctrl+K to expand Comms. Graph shortcuts are scoped to the Vault and excluded from editable/control elements. Reduced-motion preferences suppress graph animation.

## Release procedure

1. Check `git status`, review every changed file, and exclude private/unrelated files. The existing `.astra-hq-brief.md` is not part of the release.
2. Run syntax checks, the full browser suite, and screenshot/a11y audit. Verify empty, blocked-CDN/WebGL, corrupted-storage and connection error states. Exercise actual camera selection and touch-sized layouts.
3. Obtain an independent code review and resolve blocking findings. Review additions for credentials, unsafe HTML and unsafe network destinations.
4. Verify the existing Pages configuration before pushing:
   ```sh
   gh api repos/maxim-mayster/personal-hq/pages
   gh api repos/maxim-mayster/personal-hq/pages/builds/latest
   ```
   The verified baseline publishes `main` at `/` using legacy branch-based Pages.
5. Commit only tested files and push to the existing repository. Do not add an unrelated hosting service or change global Hermes configuration.
6. Read back the latest Pages build and require `built` with the exact pushed commit. Fetch https://maxim-mayster.github.io/personal-hq/ with a unique cache-busting query. Require HTTP 200 and compare downloaded HTML with the committed `index.html` using SHA-256. Exercise the live page once more before claiming publication.

## Audit handoff — not a release certificate

Verified starting commit: `de7c13cf9768537c9aa300d037c06a345990807b`. Local source, local HTTP response and deployed HTML had identical SHA-256: `6cbfad35d2991566789d5e54c6d2e29c0ebed46bd772c7cda3569b6088a648a1`. Pages reported built at that commit.

Baseline findings included: boot trapped by CDN failure; NaN star geometry errors; graph shortcuts consuming spaces in text fields; mobile Vault horizontal overflow; unlabeled settings switches; fake confidence/live-state claims; unsafe innerHTML for chat/activity; incomplete graph edges; decorative task/agent/settings interactions; unvalidated Obsidian destination and fragile import lifecycle.

During implementation, six Playwright tests passed together and inline syntax/ID checks passed. Those covered settings/panel/agent keyboard flows, original-zone responsive overflow, safe local Comms commands, persisted task-to-memory workflows, deterministic graph/typing behavior, and blocked-CDN fallback.

IMPORTANT: connection-hardening edits were made AFTER that six-test green run. The new Obsidian test was observed failing against the old unsafe implementation; the subsequent fix was not rerun before the execution window ended. The final working tree therefore is NOT release-verified. Final accessibility/screenshot review, full tests, independent review, commit, push and live verification remain outstanding. No new release was published in this pass. Do not treat the earlier green run as validation of the final tree.
