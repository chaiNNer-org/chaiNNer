from __future__ import annotations

from typing import Any, Callable, Literal, NewType

NodeId = NewType("NodeId", str)
InputId = NewType("InputId", int)
OutputId = NewType("OutputId", int)
FeatureId = NewType("FeatureId", str)


RunFn = Callable[..., Any]

NodeKind = Literal["regularNode", "newIterator", "collector"]
