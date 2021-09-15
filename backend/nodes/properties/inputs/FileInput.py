from typing import Dict
from ..InputFactory import InputFactory
from ..InputBase import InputBase


@InputFactory.register('file')
class FileInput(InputBase):
    """ Input for selecting a local file """
    def __init__(self, label: str):
        """ Constructor """
        self.label = label
        self.accepts = None

        self.type = 'file'