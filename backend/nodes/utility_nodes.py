"""
Nodes that provide various generic utility
"""

import math
import multiprocessing as mp
import os
import queue
import re
import signal
import sys
import threading

import cv2
import numpy as np
from ncnn_vulkan import ncnn
from sanic.log import logger

from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs.file_inputs import *
from .properties.inputs.generic_inputs import *
from .properties.inputs.numpy_inputs import *
from .properties.outputs.generic_outputs import *
from .properties.outputs.numpy_outputs import *
from .utils.utils import ncnn_auto_split_process


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
        self.sub = "Misc"

    def run(self) -> None:
        return


@NodeFactory.register("Utility", "Math")
class MathNode(NodeBase):
    """Math node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Perform mathematical operations on numbers."
        self.inputs = [
            NumberInput("Operand A"),
            MathOpsDropdown(),
            NumberInput("Operand B"),
        ]
        self.outputs = [NumberOutput("Result")]
        self.icon = "MdCalculate"
        self.sub = "Math"

    def run(self, in1: str, op: str, in2: str) -> int:
        in1, in2 = int(in1), int(in2)

        if op == "add":
            return in1 + in2
        elif op == "sub":
            return in1 - in2
        elif op == "mul":
            return in1 * in2
        elif op == "div":
            return in1 / in2
        elif op == "pow":
            return in1 ** in2



@NodeFactory.register("NCNN", "Test")
class NcnnNode(NodeBase):
    """NCNN node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Perform inference with NCNN."
        self.inputs = [ImageInput(), ParamFileInput(), BinFileInput()]
        self.outputs = [ImageOutput()]
        self.icon = "NCNN"
        self.sub = "NCNN"

    def get_scale(self, param_path):
        with open(param_path) as f:
            lines = f.read()
            regex = 'Interp\s*\w*\s*.*2=(\d.?\d*)'
            matches = re.findall(regex, lines)
            return int(np.prod([float(n) for n in matches]))

    # def run(self, img: np.ndarray, param_path: str, bin_path: str) -> np.ndarray:
    #     try:
    #         # We have to assume in_nc is 3 always because ncnn param files do not have a way to get this
    #         in_nc = 3
    #         gray = False
    #         if img.ndim == 2:
    #             gray = True
    #             logger.warn("Expanding image channels")
    #             img = np.tile(np.expand_dims(img, axis=2), (1, 1, min(in_nc, 3)))
    #         # Remove extra channels if too many (i.e three channel image, single channel model)
    #         elif img.shape[2] > in_nc:
    #             logger.warn("Truncating image channels")
    #             img = img[:, :, :in_nc]

    #         img = (img * 255).astype(np.uint8)
    #         scale = self.get_scale(param_path)
    #         self.generic_inference = RealSR(
    #             gpuid=0, scale=scale, tta_mode=False, param_path=param_path, bin_path=bin_path)

    #         output, _ = ncnn_auto_split_process(img, self.generic_inference.process, scale)

    #         output = output.astype(np.float32) / 255

    #         if gray:
    #             output = np.average(output, axis=2).astype(np.float32)

    #         return output
    #     except Exception as e:
    #         logger.warn(e)
    #         raise e
    
    def run(self, img: np.ndarray, param_path: str, bin_path: str) -> np.ndarray:
        net = ncnn.Net()

        # Use vulkan compute
        net.opt.use_vulkan_compute = True

        # Load model param and bin
        net.load_param(param_path)
        net.load_model(bin_path)

        scale = self.get_scale(param_path)

        # TODO: auto grab input/output names
        # Try/except block to catch errors
        try:
            output, _ = ncnn_auto_split_process(img, net, scale)
            net.clear()
            return output
        except Exception as e:
            print(e)
            # ncnn.destroy_gpu_instance()

