from __future__ import annotations

from typing import Any, Awaitable, Callable, Literal, Union

RunFn = Callable[..., Any]

NodeType = Literal["regularNode", "iterator", "iteratorHelper", "newIterator"]

UpdateProgressFn = Callable[[str, float, Union[float, None]], Awaitable[None]]
