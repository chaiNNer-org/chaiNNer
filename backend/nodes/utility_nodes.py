"""
Nodes that provide various generic utility
"""

import math
import os
import sys

import cv2
import numpy as np
from sanic.log import logger

from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs.generic_inputs import NoteTextAreaInput


@NodeFactory.register("Utility", "Note")
class NoteNode(NodeBase):
    """Sticky note node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Make a sticky note for whatever notes or comments you want to leave in the chain."
        self.inputs = [NoteTextAreaInput()]
        self.outputs = []
        self.icon = "MdOutlineStickyNote2"
        self.sub = "Utility"

    def run(self) -> None:
        return
