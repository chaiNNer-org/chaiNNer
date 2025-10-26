#!/usr/bin/env python3
"""
Mock backend server for testing the chaiNNer frontend without a full backend.
This provides minimal API endpoints needed for the frontend to function.
"""

import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

# Mock Python info
PYTHON_INFO = {
    "python": "/usr/bin/python3",
    "version": "3.11.0",
}

# Mock backend status
BACKEND_STATUS = {
    "ready": True,
    "worker": None,
}

# Mock packages
PACKAGES = []

# Mock categories
CATEGORIES = [
    {
        "id": "chainner:utility",
        "name": "Utility",
        "description": "Utility nodes for testing",
        "icon": "BsGear",
        "color": "#777777",
        "installHint": None,
    }
]

# Mock nodes - minimal test nodes
NODES = [
    {
        "schemaId": "chainner:utility:text_input",
        "name": "Text Input",
        "description": "A simple text input node",
        "icon": "BsTextareaT",
        "category": "chainner:utility",
        "inputs": [],
        "outputs": [
            {
                "id": 0,
                "type": "string",
                "label": "Text",
                "description": "Output text",
            }
        ],
        "groupLayout": [],
        "iteratorInputs": [],
        "iteratorOutputs": [],
        "kind": "regularNode",
        "hasSideEffects": False,
        "deprecated": False,
        "features": [],
        "suggestions": [],
        "nodeGroup": "chainner:utility",
    },
    {
        "schemaId": "chainner:utility:text_output",
        "name": "Text Output",
        "description": "A simple text output node",
        "icon": "BsTextareaT",
        "category": "chainner:utility",
        "inputs": [
            {
                "id": 0,
                "type": "string",
                "label": "Text",
                "description": "Input text",
            }
        ],
        "outputs": [],
        "groupLayout": [],
        "iteratorInputs": [],
        "iteratorOutputs": [],
        "kind": "regularNode",
        "hasSideEffects": True,
        "deprecated": False,
        "features": [],
        "suggestions": [],
        "nodeGroup": "chainner:utility",
    },
    {
        "schemaId": "chainner:utility:number_input",
        "name": "Number Input",
        "description": "A simple number input node",
        "icon": "BsTextareaT",
        "category": "chainner:utility",
        "inputs": [],
        "outputs": [
            {
                "id": 0,
                "type": "number",
                "label": "Number",
                "description": "Output number",
            }
        ],
        "groupLayout": [],
        "iteratorInputs": [],
        "iteratorOutputs": [],
        "kind": "regularNode",
        "hasSideEffects": False,
        "deprecated": False,
        "features": [],
        "suggestions": [],
        "nodeGroup": "chainner:utility",
    },
]

# Mock feature states
FEATURES: list[Any] = []


class MockBackendHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the mock backend."""

    def _set_headers(self, status_code: int = 200) -> None:
        self.send_response(status_code)
        self.send_header("Content-type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self) -> None:
        """Handle OPTIONS requests for CORS."""
        self._set_headers()

    def do_GET(self) -> None:
        """Handle GET requests."""
        if self.path == "/nodes":
            self._set_headers()
            response = {
                "nodes": NODES,
                "categories": CATEGORIES,
                "categoriesMissingNodes": [],
            }
            self.wfile.write(json.dumps(response).encode())

        elif self.path == "/python-info":
            self._set_headers()
            self.wfile.write(json.dumps(PYTHON_INFO).encode())

        elif self.path == "/status":
            self._set_headers()
            self.wfile.write(json.dumps(BACKEND_STATUS).encode())

        elif self.path == "/packages":
            self._set_headers()
            self.wfile.write(json.dumps(PACKAGES).encode())

        elif self.path == "/features":
            self._set_headers()
            self.wfile.write(json.dumps(FEATURES).encode())

        elif self.path == "/installed-dependencies":
            self._set_headers()
            self.wfile.write(json.dumps({}).encode())

        elif self.path == "/system-usage":
            self._set_headers()
            self.wfile.write(json.dumps([]).encode())

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Not found"}).encode())

    def do_POST(self) -> None:
        """Handle POST requests."""
        if self.path == "/run":
            self._set_headers()
            response = {"type": "success"}
            self.wfile.write(json.dumps(response).encode())

        elif self.path == "/run/individual":
            self._set_headers()
            response = {"success": True, "data": None}
            self.wfile.write(json.dumps(response).encode())

        elif self.path in ["/pause", "/resume", "/kill", "/shutdown"]:
            self._set_headers()
            response = {"type": "success"}
            self.wfile.write(json.dumps(response).encode())

        elif self.path == "/clear-cache/individual":
            self._set_headers()
            response = {"success": True, "data": None}
            self.wfile.write(json.dumps(response).encode())

        elif self.path in ["/packages/install", "/packages/uninstall"]:
            self._set_headers()
            self.wfile.write(json.dumps({}).encode())

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Not found"}).encode())

    def log_message(self, format: str, *args: Any) -> None:
        """Log messages to stdout."""
        print(f"[{self.address_string()}] {format % args}")


def run_mock_backend(port: int = 8000) -> None:
    """Run the mock backend server."""
    server_address = ("", port)
    httpd = HTTPServer(server_address, MockBackendHandler)
    print(f"Mock backend server running on http://localhost:{port}")
    print("Press Ctrl+C to stop")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping mock backend server...")
        httpd.shutdown()


if __name__ == "__main__":
    import sys

    port = 8000
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    run_mock_backend(port)
