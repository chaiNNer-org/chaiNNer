from __future__ import annotations

from typing import Awaitable, Callable, Union

UpdateProgressFn = Callable[[str, float, Union[float, None]], Awaitable[None]]
