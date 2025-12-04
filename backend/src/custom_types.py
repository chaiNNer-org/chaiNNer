from __future__ import annotations

from collections.abc import Awaitable, Callable

UpdateProgressFn = Callable[[str, float, float | None], Awaitable[None]]
