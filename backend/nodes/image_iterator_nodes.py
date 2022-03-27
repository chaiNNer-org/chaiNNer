import math
import os
import sys
from msilib.schema import Directory

import cv2
import numpy as np
from sanic.log import logger

from .node_base import IteratorNodeBase, NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *


@NodeFactory.register("Image", "Image Path")
class ImageFileIteratorPathNode(NodeBase):
    """Image File Iterator node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput()]
        self.outputs = [ImageFileOutput()]

        self.icon = "MdLoop"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

    def run(self) -> any:
        return ""


@NodeFactory.register("Image", "Image File Iterator")
class ImageFileIteratorNode(IteratorNodeBase):
    """Image File Iterator node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Iterate over all files in a directory and run the provided nodes on just the image files."
        self.inputs = [
            DirectoryInput(),
        ]
        self.outputs = []
        self.default_nodes = [
            # TODO: Figure out a better way to do this
            {
                "category": "Image",
                "name": "Image Path",
            },
        ]

    def run(self) -> any:
        return ""
