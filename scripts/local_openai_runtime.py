#!/usr/bin/env python3
"""
Lightweight local OpenAI-compatible inference server for M7-A validation.
Runs on http://127.0.0.1:1234/v1 mimicking runtimes like vLLM / LM Studio.
Supports:
  - GET  /v1/models
  - POST /v1/chat/completions (SSE streaming and tool calling)
"""

import json
import sys
import time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler

PORT = 1234
MODEL_ID = "local-coding-model"

class OpenAICompatHandler(BaseHTTPRequestHandler):
    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.rstrip("/")
        if path in ("/v1/models", "/models"):
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._send_cors()
            self.end_headers()
            response = {
                "object": "list",
                "data": [
                    {
                        "id": MODEL_ID,
                        "object": "model",
                        "created": int(time.time()),
                        "owned_by": "local",
                    }
                ],
            }
            self.wfile.write(json.dumps(response).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        path = self.path.rstrip("/")
        if path in ("/v1/chat/completions", "/chat/completions"):
            content_length = int(self.headers.get("Content-Length", 0))
            body_data = self.rfile.read(content_length)
            try:
                payload = json.loads(body_data.decode("utf-8"))
            except Exception:
                payload = {}

            messages = payload.get("messages", [])
            tools = payload.get("tools", [])
            stream = payload.get("stream", False)
            last_user_msg = ""
            for m in reversed(messages):
                if m.get("role") == "user":
                    last_user_msg = m.get("content", "")
                    break

            self.close_connection = True
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "close")
            self._send_cors()
            self.end_headers()

            # If prompt asks for validation and tools are available
            if "validation" in last_user_msg.lower() and tools:
                # Emit a streaming tool call to read file or propose edit
                chunks = [
                    {
                        "id": "chatcmpl-local-1",
                        "object": "chat.completion.chunk",
                        "created": int(time.time()),
                        "model": MODEL_ID,
                        "choices": [
                            {
                                "index": 0,
                                "delta": {
                                    "role": "assistant",
                                    "content": "I will examine the validator implementation and add the required input validation.\n",
                                },
                            }
                        ],
                    },
                    {
                        "id": "chatcmpl-local-1",
                        "object": "chat.completion.chunk",
                        "created": int(time.time()),
                        "model": MODEL_ID,
                        "choices": [
                            {
                                "index": 0,
                                "delta": {
                                    "tool_calls": [
                                        {
                                            "index": 0,
                                            "id": "call_local_tool_1",
                                            "type": "function",
                                            "function": {
                                                "name": "read_file",
                                                "arguments": json.dumps({"filePath": "src/validator.ts"}),
                                            },
                                        }
                                    ]
                                },
                            }
                        ],
                    },
                    {
                        "id": "chatcmpl-local-1",
                        "object": "chat.completion.chunk",
                        "created": int(time.time()),
                        "model": MODEL_ID,
                        "choices": [{"index": 0, "delta": {}}],
                        "usage": {"prompt_tokens": 48, "completion_tokens": 24},
                    },
                ]
            else:
                # Text response stream
                response_text = f"Local model ({MODEL_ID}) processed prompt: {last_user_msg[:60]}... Execution verified."
                chunks = [
                    {
                        "id": "chatcmpl-local-1",
                        "object": "chat.completion.chunk",
                        "created": int(time.time()),
                        "model": MODEL_ID,
                        "choices": [{"index": 0, "delta": {"role": "assistant", "content": response_text}}],
                    },
                    {
                        "id": "chatcmpl-local-1",
                        "object": "chat.completion.chunk",
                        "created": int(time.time()),
                        "model": MODEL_ID,
                        "choices": [{"index": 0, "delta": {}}],
                        "usage": {"prompt_tokens": 32, "completion_tokens": 16},
                    },
                ]

            try:
                for chunk in chunks:
                    line = f"data: {json.dumps(chunk)}\n\n"
                    self.wfile.write(line.encode("utf-8"))
                    self.wfile.flush()
                    time.sleep(0.02)

                self.wfile.write(b"data: [DONE]\n\n")
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        # Silence default stderr logging to keep test output clean
        pass

def main():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), OpenAICompatHandler)
    server.daemon_threads = True
    print(f"Local OpenAI-Compatible Server running at http://127.0.0.1:{PORT}/v1", flush=True)
    server.serve_forever()

if __name__ == "__main__":
    main()
