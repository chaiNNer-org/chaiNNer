from typing import Callable, Dict, TypeVar

from sanic.log import logger

from .node_base import NodeBase

T = TypeVar("T", bound=NodeBase)


# Implementation based on https://medium.com/@geoffreykoh/implementing-the-factory-pattern-via-dynamic-registry-and-python-decorators-479fc1537bbe
class NodeFactory:
    """The factory class for creating nodes"""

    registry: Dict[str, Callable[[], NodeBase]] = {}
    """ Internal registry for available nodes """

    __node_cache: Dict[str, NodeBase] = {}

    @classmethod
    def get_node(cls, schema_id: str) -> NodeBase:
        """Factory command to create the node"""

        node = cls.__node_cache.get(schema_id)
        if node is None:
            node_class = cls.registry[schema_id]
            node = node_class()
            cls.__node_cache[schema_id] = node
        return node

    @classmethod
    def register(cls, schema_id: str):
        def inner_wrapper(wrapped_class: Callable[[], T]) -> Callable[[], T]:
            if schema_id not in cls.registry:
                cls.registry[schema_id] = wrapped_class
            else:
                logger.warning(f"Node {schema_id} already exists. Will replace it")
            return wrapped_class

        return inner_wrapper

    @classmethod
    def get_registry(cls):
        return cls.registry
