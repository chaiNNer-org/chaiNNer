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

    def toDict(self, package_author: str, package_name: str):
        return {
            "name": self.name,
            "description": self.description,
            "nodes": [node.toDict(package_author, package_name) for node in self.nodes],
        }
