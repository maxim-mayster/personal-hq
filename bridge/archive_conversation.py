#!/usr/bin/env python3
"""Archive a structured Hermes conversation into the local ARIA bridge.

Input JSON on stdin:
{"title": "...", "summary": "...", "decisions": [...], "next_steps": [...], "transcript": "...", "tags": [...]}
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import urllib.request

BRIDGE = os.getenv("ARIA_BRIDGE_URL", "http://127.0.0.1:8766").rstrip("/")

def slug(value: str) -> str:
    value = re.sub(r"[^A-Za-z0-9 _-]+", "", value).strip()
    value = re.sub(r"\s+", " ", value)
    return value[:90] or "Untitled Conversation"

def bullets(items):
    return "\n".join(f"- {str(x).strip()}" for x in items if str(x).strip()) or "- None recorded"

def main():
    data = json.load(__import__("sys").stdin)
    title = slug(str(data.get("title", "Untitled Conversation")))
    now = dt.datetime.now().astimezone()
    date = now.date().isoformat()
    path = f"AGENT OS/04 - Research/Session Summaries/{date} - {title}.md"
    tags = data.get("tags", ["aria", "conversation", "session-summary"])
    content = f"""---
type: resource
source: hermes
status: archived
created: {date}
tags: {', '.join('#'+re.sub(r'[^A-Za-z0-9_-]', '', str(t)) for t in tags)}
---
# {title}

## Summary
{str(data.get('summary', '')).strip() or 'No summary provided.'}

## Durable decisions and preferences
{bullets(data.get('decisions', []))}

## Next steps
{bullets(data.get('next_steps', []))}

## Source context
The following is preserved for future reference. Secrets, credentials, tokens, and private authentication material must never be included.

{str(data.get('transcript', '')).strip() or 'No source transcript provided.'}

## Related notes
- [[Knowledge Manager Storage Rules]]
- [[ARIA Obsidian Bridge Connection]]
"""
    payload = json.dumps({"path": path, "content": content}).encode()
    req = urllib.request.Request(BRIDGE + "/api/memory", data=payload, method="POST", headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as response:
        result = json.loads(response.read())
    print(json.dumps({"path": path, "bridge": result}, indent=2))

if __name__ == "__main__":
    main()
