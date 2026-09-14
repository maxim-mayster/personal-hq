#!/usr/bin/env python3
"""Local ARIA <-> Obsidian bridge.

Keeps the Obsidian REST token on the user's machine. The static HQ talks to
this loopback service; it never receives the token and never needs a cloud key.
"""
from __future__ import annotations

import json
import os
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = os.getenv("ARIA_BRIDGE_HOST", "127.0.0.1")
PORT = int(os.getenv("ARIA_BRIDGE_PORT", "8766"))
OBSIDIAN_URL = os.getenv("OBSIDIAN_API_URL", "https://127.0.0.1:27124").rstrip("/")
TOKEN = os.getenv("OBSIDIAN_REST_TOKEN", "")
MAX_BODY = 256 * 1024
ALLOWED_ORIGIN = os.getenv("ARIA_ALLOWED_ORIGIN", "https://maxim-mayster.github.io")


def safe_note_path(value: str) -> str:
    value = value.replace("\\", "/").lstrip("/")
    if not value or "\x00" in value or any(part in {"", ".", ".."} or part.startswith(".") for part in value.split("/")):
        raise ValueError("invalid note path")
    if not value.lower().endswith(".md"):
        raise ValueError("memory path must end in .md")
    return value


def obsidian_request(method: str, path: str, body: bytes | None = None, content_type: str | None = None):
    encoded = "/".join(urllib.parse.quote(part, safe="") for part in path.split("/"))
    req = urllib.request.Request(f"{OBSIDIAN_URL}/vault/{encoded}", data=body, method=method)
    if TOKEN:
        req.add_header("Authorization", f"Bearer {TOKEN}")
    if content_type:
        req.add_header("Content-Type", content_type)
    req.add_header("Accept", "application/json, text/plain")
    context = ssl._create_unverified_context() if OBSIDIAN_URL.startswith("https://127.0.0.1") else None
    with urllib.request.urlopen(req, timeout=12, context=context) as response:
        return response.status, response.headers.get_content_type(), response.read(MAX_BODY + 1)


class Handler(BaseHTTPRequestHandler):
    server_version = "ARIA-Obsidian-Bridge/0.1"

    def log_message(self, format, *args):
        print("[aria-bridge] " + (format % args), flush=True)

    def end_headers(self):
        origin = self.headers.get("Origin")
        if origin and (origin == ALLOWED_ORIGIN or re.match(r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$", origin)):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status: int, payload: dict):
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/health":
            self.send_json(200, {"ok": True, "obsidian_configured": bool(TOKEN), "write_enabled": bool(TOKEN)})
            return
        if parsed.path == "/api/status":
            self.send_json(200, {"service": "aria-obsidian-bridge", "obsidian_url": OBSIDIAN_URL, "configured": bool(TOKEN)})
            return
        if parsed.path == "/vault" or parsed.path.startswith("/vault/"):
            relative = urllib.parse.unquote(parsed.path[len("/vault/"):]) if parsed.path.startswith("/vault/") else ""
            try:
                status, content_type, body = obsidian_request("GET", relative)
            except urllib.error.HTTPError as exc:
                self.send_json(exc.code, {"error": f"Obsidian returned HTTP {exc.code}"})
                return
            except Exception as exc:
                self.send_json(502, {"error": f"Obsidian unavailable: {exc}"})
                return
            if len(body) > MAX_BODY:
                self.send_json(413, {"error": "Obsidian response exceeds bridge limit"})
                return
            self.send_response(status)
            self.send_header("Content-Type", "application/json" if content_type == "application/json" else "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/api/memory":
            self.send_json(404, {"error": "not found"})
            return
        if not TOKEN:
            self.send_json(503, {"error": "OBSIDIAN_REST_TOKEN is not configured"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY:
                raise ValueError("request body must be between 1 and 262144 bytes")
            payload = json.loads(self.rfile.read(length))
            path = safe_note_path(str(payload.get("path", "")))
            content = str(payload.get("content", ""))
            if not content.strip():
                raise ValueError("memory content cannot be empty")
            status, _, _ = obsidian_request("PUT", path, content.encode(), "text/markdown; charset=utf-8")
        except ValueError as exc:
            self.send_json(400, {"error": str(exc)})
            return
        except urllib.error.HTTPError as exc:
            self.send_json(exc.code, {"error": f"Obsidian returned HTTP {exc.code}"})
            return
        except Exception as exc:
            self.send_json(502, {"error": f"write failed: {exc}"})
            return
        self.send_json(200, {"ok": True, "path": path, "status": status})


def main():
    print(f"ARIA Obsidian bridge listening on http://{HOST}:{PORT}", flush=True)
    print(f"Obsidian target: {OBSIDIAN_URL}; token configured: {bool(TOKEN)}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
