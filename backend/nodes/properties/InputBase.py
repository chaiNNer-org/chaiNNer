from abc import ABCMeta, abstractmethod
from typing import Dict


class InputBase(metaclass=ABCMeta):
    """ Base class for an input """
    def __init__(self, **kwargs):
        """ Constructor """
        pass

    def toDict(self) -> Dict:
        """ Method to return an input's information """
        output = {
            'type': self.type,
            'label': self.label,
            'accepts': self.accepts
        }
        return output