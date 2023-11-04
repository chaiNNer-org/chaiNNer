from __future__ import annotations

from typing import Any, Generic, NewType, TypeVar, Union

from .input import BaseInput
from .types import InputId

T = TypeVar("T")


GroupId = NewType("GroupId", int)


class GroupInfo:
    def __init__(
        self,
        group_id: GroupId,
        kind: str,
        options: dict[str, Any] | None = None,
    ) -> None:
        self.id: GroupId = group_id
        self.kind: str = kind
        self.options: dict[str, Any] = {} if options is None else options


class Group(Generic[T]):
    def __init__(self, info: GroupInfo, items: list[T]) -> None:
        self.info: GroupInfo = info
        self.items: list[T] = items

    def to_dict(self):
        return {
            "id": self.info.id,
            "kind": self.info.kind,
            "options": self.info.options,
            "items": [i.to_dict() if isinstance(i, Group) else i for i in self.items],
        }


NestedGroup = Group[Union[BaseInput, "NestedGroup"]]
NestedIdGroup = Group[Union[InputId, "NestedIdGroup"]]


# pylint: disable-next=redefined-builtin
def group(kind: str, options: dict[str, Any] | None = None, id: int = -1):
    info = GroupInfo(GroupId(id), kind, options)

    def ret(*items: BaseInput | NestedGroup) -> NestedGroup:
        return Group(info, list(items))

    return ret
