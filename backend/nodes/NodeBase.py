from abc import ABCMeta, abstractmethod
from typing import Any


class NodeBase(metaclass=ABCMeta):
    """ Base class for a node """
    def __init__(self, **kwargs):
        """ Constructor """
        pass

    @abstractmethod
    def run(self, command: str) -> Any:
        """ Abstract method to run a command """
        pass


# end class NodeBase
