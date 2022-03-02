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

    def get_param_info(self, param_path):
        scale = 4
        input_name = 'data'
        output_name = 'output'
        out_nc = 3

        with open(param_path) as f:
            lines = f.read()

            # Scale
            regex = 'Interp\s*\w*\s*.*2=(\d.?\d*)'
            matches = re.findall(regex, lines)
            scale = int(np.prod([float(n) for n in matches]))

            # Input name
            regex = 'Input\s+([\w.]+)\s+0\s1\s(\w+)'
            matches = re.findall(regex, lines)
            if len(matches) > 0:
                if any(isinstance(el, tuple) for el in matches):
                    matches = matches[-1]
                _, input_name = matches

            # Output name & out nc
            regex = '\w+\s+([\w.]+)\s+\d+\s+\d+\s+\d+\s+([^\d\s]+)\s0=(\d)'
            matches = re.findall(regex, lines)
            if len(matches) > 0:
                if any(isinstance(el, tuple) for el in matches):
                    matches = matches[-1]
                _, output_name, out_nc = matches
        
        return scale, input_name, output_name, out_nc


    def run(self, img: np.ndarray, param_path: str, bin_path: str) -> np.ndarray:
        # ncnn only supports 3 apparently
        in_nc = 3
        gray = False
        if img.ndim == 2:
            gray = True
            logger.warn("Expanding image channels")
            img = np.tile(np.expand_dims(img, axis=2), (1, 1, min(in_nc, 3)))
        # Remove extra channels if too many (i.e three channel image, single channel model)
        elif img.shape[2] > in_nc:
            logger.warn("Truncating image channels")
            img = img[:, :, :in_nc]
        # Pad with solid alpha channel if needed (i.e three channel image, four channel model)
        elif img.shape[2] == 3 and in_nc == 4:
            logger.warn("Expanding image channels")
            img = np.dstack((img, np.full(img.shape[:-1], 1.0)))

        net = ncnn.Net()

        # Use vulkan compute
        net.opt.use_vulkan_compute = True

        # Load model param and bin
        net.load_param(param_path)
        net.load_model(bin_path)

        scale, input_name, output_name, out_nc = self.get_param_info(param_path)
        logger.info(f'{scale}, {input_name}, {output_name}')

        # Try/except block to catch errors
        try:
            output, _ = ncnn_auto_split_process(img, net, scale, input_name=input_name, output_name=output_name)
            net.clear()
            if gray:
                output = np.average(output, axis=2)
            return output
        except Exception as e:
            logger.error(e)
            raise RuntimeError("An unexpected error occurred during NCNN processing.")



