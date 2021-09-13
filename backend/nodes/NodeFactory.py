from typing import Callable
from . import NodeBase

import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Implementation based on https://medium.com/@geoffreykoh/implementing-the-factory-pattern-via-dynamic-registry-and-python-decorators-479fc1537bbe
class NodeFactory:
    """ The factory class for creating nodes"""

    registry = {}
    """ Internal registry for available nodes """
    @classmethod
    def create_node(cls, category: str, name: str, **kwargs) -> NodeBase:
        """ Factory command to create the node """

        node_class = cls.registry[category][name]
        node = node_class(**kwargs)
        return node

    # end create_node()

    @classmethod
    def register(cls, category: str, name: str) -> Callable:
        def inner_wrapper(wrapped_class: NodeBase) -> Callable:
            if category not in cls.registry:
                cls.registry[category] = {}
            if name in cls.registry[category]:
                logger.warning(f'Node {name} already exists. Will replace it')
            cls.registry[category][name] = wrapped_class
            return wrapped_class

        return inner_wrapper

    # end register()


# end class NodeFactory