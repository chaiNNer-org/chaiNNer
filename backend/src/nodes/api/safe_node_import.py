from __future__ import annotations

from .node_base import NodeBase


def i(path: str, class_name: str) -> NodeBase | None:
    """Import the node at the path and return it, or return nothing if it fails"""
    try:
        module = __import__(path, fromlist=[class_name])
        return getattr(module, class_name)
    except Exception as e:
        # TODO: make this return a dict of missing node info
        print(f"Failed to import {path}: {e}")
        return None
