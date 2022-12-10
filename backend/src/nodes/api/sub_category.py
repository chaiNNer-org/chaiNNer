from typing import List, Union
from .node_base import NodeBase


class SubCategory:
    def __init__(
        self,
        name: str,
        description: str,
        nodes: Union[List[Union[NodeBase, None]], None] = None,
    ):
        self.name: str = name
        self.description: str = description
        self.nodes: List[NodeBase] = (
            [n for n in nodes if n is not None] if nodes is not None else []
        )

    def toDict(self):
        return {
            "name": self.name,
            "description": self.description,
            "nodes": [node.toDict() for node in self.nodes],
        }

    def __repr__(self):
        return str(self.toDict())

    def __iter__(self):
        yield from self.toDict().items()
