#!/usr/bin/env python3
"""
Simple script to export node data to JSON file.
This can be run after the backend has started to capture node data.
"""

from __future__ import annotations

import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

def fetch_and_save_nodes(server_url: str, output_file: Path):
    """Fetch node data and save to JSON."""
    try:
        print(f"Fetching nodes from {server_url}/nodes...")
        response = urllib.request.urlopen(f"{server_url}/nodes", timeout=60)
        data = json.loads(response.read().decode('utf-8'))
        
        # Save to file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        
        print(f"Saved {len(data.get('nodes', []))} nodes to {output_file}")
        return 0
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    server_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"
    output_file = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("nodes_data.json")
    sys.exit(fetch_and_save_nodes(server_url, output_file))
