from typing import Dict
from ..InputFactory import InputFactory
from ..InputBase import InputBase

import numpy as np


@InputFactory.register('image')
class FileInput(InputBase):
    """ Input for selecting a local file """
    def __init__(self, label: str):
        """ Constructor """
        self.label = label
        self.accepts = ['numpy']

        self.type = 'image'