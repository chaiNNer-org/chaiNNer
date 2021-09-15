from typing import Callable, Dict, Optional
from . import InputBase

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Implementation based on https://medium.com/@geoffreykoh/implementing-the-factory-pattern-via-dynamic-registry-and-python-decorators-479fc1537bbe
class InputFactory:
    """ The factory class for creating inputs"""

    registry = {}
    """ Internal registry for available inputs """
    @classmethod
    def create_input(self, input_type: str, label: str) -> InputBase:
        """ Factory command to create the input """

        input_class = self.registry[input_type]
        input_obj = input_class(label)
        return input_obj.toDict()

    @classmethod
    def register(self, name: str) -> Callable:
        def inner_wrapper(wrapped_class: InputBase) -> Callable:
            if name in self.registry:
                logger.warning(f'Input {name} already exists. Will replace it')
            self.registry[name] = wrapped_class
            return wrapped_class

        return inner_wrapper

    @classmethod
    def get_registry(self) -> Dict:
        return self.registry