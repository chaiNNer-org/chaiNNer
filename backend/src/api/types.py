from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal, NewType

NodeId = NewType("NodeId", str)
InputId = NewType("InputId", int)
OutputId = NewType("OutputId", int)
IterInputId = NewType("IterInputId", int)
IterOutputId = NewType("IterOutputId", int)
FeatureId = NewType("FeatureId", str)


RunFn = Callable[..., Any]

NodeKind = Literal["regularNode", "generator", "collector", "transformer"]
