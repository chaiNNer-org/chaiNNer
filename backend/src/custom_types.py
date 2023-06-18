from __future__ import annotations

from typing import Any, Callable, Literal

RunFn = Callable[..., Any]

NodeType = Literal["regularNode", "iterator", "iteratorHelper"]
