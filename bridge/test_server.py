import json
import os
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen

import server


class MockObsidian(BaseHTTPRequestHandler):
    notes = {"Root.md": "# Root\n[[Projects/Plan]]", "Projects/Plan.md": "---\ntype: project\n---\n# Plan"}
    writes = {}

    def do_GET(self):
        if self.path == "/vault/":
            body = json.dumps({"files": ["Root.md", "Projects/"]}).encode()
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(body)
        elif self.path == "/vault/Projects/":
            body = json.dumps({"files": ["Plan.md"]}).encode()
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(body)
        elif self.path.startswith("/vault/"):
            key = self.path.removeprefix("/vault/")
            body = self.notes.get(key, "").encode()
            self.send_response(200 if body else 404); self.end_headers(); self.wfile.write(body)
        else:
            self.send_response(404); self.end_headers()

    def do_PUT(self):
        key = self.path.removeprefix("/vault/")
        self.wfile.flush()
        self.__class__.writes[key] = self.rfile.read(int(self.headers["Content-Length"])).decode()
        self.send_response(204); self.end_headers()

    def log_message(self, format, *args): pass


class BridgeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mock = ThreadingHTTPServer(("127.0.0.1", 0), MockObsidian)
        threading.Thread(target=cls.mock.serve_forever, daemon=True).start()
        server.OBSIDIAN_URL = f"http://127.0.0.1:{cls.mock.server_address[1]}"
        server.TOKEN = "test-token"
        cls.bridge = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        threading.Thread(target=cls.bridge.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.bridge.server_address[1]}"

    @classmethod
    def tearDownClass(cls):
        cls.bridge.shutdown(); cls.mock.shutdown()

    def test_health_does_not_expose_token(self):
        data = json.loads(urlopen(self.base + "/health").read())
        self.assertTrue(data["obsidian_configured"])
        self.assertNotIn("token", data)

    def test_proxy_and_write(self):
        listing = json.loads(urlopen(self.base + "/vault/").read())
        self.assertIn("Root.md", listing["files"])
        req = Request(self.base + "/api/memory", data=json.dumps({"path": "Memory/Test.md", "content": "# Test"}).encode(), headers={"Content-Type": "application/json"}, method="POST")
        result = json.loads(urlopen(req).read())
        self.assertEqual(result["path"], "Memory/Test.md")
        self.assertEqual(MockObsidian.writes["Memory/Test.md"], "# Test")

    def test_rejects_traversal(self):
        req = Request(self.base + "/api/memory", data=json.dumps({"path": "../secret.md", "content": "x"}).encode(), headers={"Content-Type": "application/json"}, method="POST")
        with self.assertRaises(Exception): urlopen(req)


if __name__ == "__main__":
    unittest.main()
