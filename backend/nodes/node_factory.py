from typing import Callable, Dict

from sanic.log import logger

from .node_base import NodeBase


# Implementation based on https://medium.com/@geoffreykoh/implementing-the-factory-pattern-via-dynamic-registry-and-python-decorators-479fc1537bbe
class NodeFactory:
    """The factory class for creating nodes"""

    registry = {}
    """ Internal registry for available nodes """

    @classmethod
    def create_node(cls, category: str, name: str) -> NodeBase:
        """Factory command to create the node"""

        node_class = cls.registry[category][name]
        node = node_class()
        # logger.info(f"Created {category}, {name} node")
        return node

    @classmethod
    def register(cls, category: str, name: str) -> Callable:
        def inner_wrapper(wrapped_class: NodeBase) -> Callable:
            if category not in cls.registry:
                cls.registry[category] = {}
            if name in cls.registry[category]:
                logger.warning(f"Node {name} already exists. Will replace it")
            cls.registry[category][name] = wrapped_class
            return wrapped_class

        return inner_wrapper

    @classmethod
    def get_registry(cls) -> Dict:
        return cls.registry
