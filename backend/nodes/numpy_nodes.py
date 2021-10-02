"""
Nodes that provide functionality for numpy array manipulation
"""

from typing import List

from cv2 import merge, split
from numpy import ndarray

from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs.numpy_inputs import ImageInput, SplitImageChannelImage
from .properties.outputs.numpy_outputs import ImageOutput, SplitImageChannelOutput


@NodeFactory.register("NumPy", "Channel::Merge")
class ChannelMergeNode(NodeBase):
    """NumPy Merger node"""

    def __init__(self):
        """Constructor"""
        self.description = "Merge numpy channels together"
        self.inputs = [SplitImageChannelImage()]
        self.outputs = [ImageOutput()]

    def run(self, imgs: List[ndarray]) -> ndarray:
        """Combine separate channels into a multi-chanel image"""

        img = merge(imgs)

        return img


@NodeFactory.register("NumPy", "Channel::Split")
class ChannelSplitNode(NodeBase):
    """NumPy Splitter node"""

    def __init__(self):
        """Constructor"""
        self.description = "Split numpy channels apart"
        self.inputs = [ImageInput()]
        self.outputs = [SplitImageChannelOutput()]

    def run(self, img: ndarray) -> ndarray:
        """Split a multi-chanel image into separate channels"""

        imgs = split(img)

        return imgs
