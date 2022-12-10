from typing import Any, Dict, Generic, List, NewType, Optional, TypeVar


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
