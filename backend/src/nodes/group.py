from typing import Any, Dict, Generic, List, NewType, Optional, TypeVar, Union

from base_types import InputId

from .properties.inputs.base_input import BaseInput

T = TypeVar("T")


GroupId = NewType("GroupId", int)


class GroupInfo:
    def __init__(
        self,
        group_id: GroupId,
        kind: str,
        options: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.id: GroupId = group_id
        self.kind: str = kind
        self.options: Dict[str, Any] = {} if options is None else options


class Group(Generic[T]):
    def __init__(self, info: GroupInfo, items: List[T]) -> None:
        self.info: GroupInfo = info
        self.items: List[T] = items

    def toDict(self):
        return {
            "id": self.info.id,
            "kind": self.info.kind,
            "options": self.info.options,
            "items": [i.toDict() if isinstance(i, Group) else i for i in self.items],
        }


NestedGroup = Group[Union[BaseInput, "NestedGroup"]]
NestedIdGroup = Group[Union[InputId, "NestedIdGroup"]]


# pylint: disable-next=redefined-builtin
def group(kind: str, options: Optional[Dict[str, Any]] = None, id: int = -1):
    info = GroupInfo(GroupId(id), kind, options)

    def ret(*items: Union[BaseInput, NestedGroup]) -> NestedGroup:
        return Group(info, list(items))

    return ret
