from __future__ import annotations

import inspect

import os


def i(path: str, class_name: str):
    """Import the node at the path and return it, or return nothing if it fails"""
    try:
        frame = inspect.stack()[1]
        p = frame[0].f_code.co_filename
        p = os.path.dirname(os.path.realpath(p))
        relative_path = os.path.relpath(os.path.join(p, path), start=os.curdir)
        importable_path = relative_path.replace("\\", ".")
        module = __import__(importable_path, fromlist=[class_name])
        return getattr(module, class_name)
    except Exception as e:
        # TODO: make this return a dict of missing node info
        print(f"Failed to import {path}: {e}")
        return None
