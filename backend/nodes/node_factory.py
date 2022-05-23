from typing import Callable, Dict

from sanic.log import logger

from .node_base import NodeBase


# Implementation based on https://medium.com/@geoffreykoh/implementing-the-factory-pattern-via-dynamic-registry-and-python-decorators-479fc1537bbe
class NodeFactory:
    """The factory class for creating nodes"""

    registry = {}
    """ Internal registry for available nodes """

    @classmethod
    def create_node(cls, schema_id: str) -> NodeBase:
        """Factory command to create the node"""

        node_class = cls.registry[schema_id]
        node = node_class()
        return node

    @classmethod
    def register(cls, schema_id: str) -> Callable:
        def inner_wrapper(wrapped_class: NodeBase) -> Callable:
            if schema_id not in cls.registry:
                cls.registry[schema_id] = wrapped_class
            else:
                logger.warning(f"Node {schema_id} already exists. Will replace it")
            return wrapped_class  # type: ignore

        return inner_wrapper

    @classmethod
    def get_registry(cls) -> Dict:
        return cls.registry
