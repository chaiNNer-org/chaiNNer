import logging
from typing import OrderedDict

import torch

from ..NodeBase import NodeBase
from ..NodeFactory import NodeFactory
from ..properties.inputs.FileInputs import PthFileInput
from ..properties.outputs.PyTorchOutputs import StateDictOutput

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@NodeFactory.register("PyTorch", "PyTorch::Read")
class LoadStateDictNode(NodeBase):
    """ Load Model node """

    def __init__(self):
        """ Constructor """
        self.inputs = [PthFileInput()]
        self.outputs = [StateDictOutput()]

    def run(self, path: str) -> OrderedDict:
        """ Read a pth file from the specified path and return it as a state dict """

        logger.info(f"Reading state dict from path: {path}")
        state_dict = torch.load(path)

        return state_dict
