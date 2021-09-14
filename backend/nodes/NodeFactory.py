from typing import Callable, Dict
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
    def create_node(self, category: str, name: str, **kwargs) -> NodeBase:
        """ Factory command to create the node """

        node_class = self.registry[category][name]
        node = node_class(**kwargs)
        return node

    @classmethod
    def register(self, category: str, name: str) -> Callable:
        def inner_wrapper(wrapped_class: NodeBase) -> Callable:
            if category not in self.registry:
                self.registry[category] = {}
            if name in self.registry[category]:
                logger.warning(f'Node {name} already exists. Will replace it')
            self.registry[category][name] = wrapped_class
            return wrapped_class

        return inner_wrapper

    @classmethod
    def get_registry(self) -> Dict:
        return self.registry