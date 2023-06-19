from __future__ import annotations

from typing import Any, Awaitable, Callable, Literal

RunFn = Callable[..., Any]

NodeType = Literal["regularNode", "iterator", "iteratorHelper"]

UpdateProgressFn = Callable[[str, float], Awaitable[None]]
