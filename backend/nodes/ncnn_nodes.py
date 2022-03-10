"""
Nodes that provide NCNN support
"""

import re

import numpy as np
from ncnn_vulkan import ncnn
from sanic.log import logger

from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.ncnn_auto_split import ncnn_auto_split_process


@NodeFactory.register("NCNN", "Load Model")
class NcnnLoadModelNode(NodeBase):
    """NCNN load model node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Load NCNN model (.bin and .param files)."
        self.inputs = [ParamFileInput(), BinFileInput()]
        self.outputs = [NcnnNetOutput()]
        self.icon = "NCNN"
        self.sub = "NCNN"

    def get_param_info(self, param_path):
        scale = 4
        input_name = "data"
        output_name = "output"
        out_nc = 3

        with open(param_path) as f:
            lines = f.read()

            assert (
                not "MemoryData" in lines
            ), "This NCNN param file contains invalid layers"

            # # Scale
            # regex = 'Interp\s*\w*\s*.*2=(\d.?\d*)'
            # matches = re.findall(regex, lines)
            # scale = int(np.prod([float(n) for n in matches]))

            # Input name
            regex = "Input\s+([\w.]+)\s+0\s1\s(\w+)"
            matches = re.findall(regex, lines)
            if len(matches) > 0:
                if any(isinstance(el, tuple) for el in matches):
                    matches = matches[-1]
                _, input_name = matches

            # Output name & out nc
            # regex = '\w+\s+([\w.]+)\s+\d+\s+\d+\s+\d+\s+([^\d\s]+)\s0=(\d)'
            regex = "\s([^\s]+)\s0=(\d)"
            matches = re.findall(regex, lines)
            if len(matches) > 0:
                if any(isinstance(el, tuple) for el in matches):
                    matches = matches[-1]
                output_name, out_nc = matches
        logger.info(f"{input_name}, {output_name}, {out_nc}")

        return input_name, output_name, out_nc

    def run(self, param_path: str, bin_path: str) -> np.ndarray:
        input_name, output_name, out_nc = self.get_param_info(param_path)

        net = ncnn.Net()

        # Use vulkan compute
        net.opt.use_vulkan_compute = True

        # Load model param and bin
        net.load_param(param_path)
        net.load_model(bin_path)

        # Put all this info with the net and disguise it as just the net
        return [(param_path, bin_path, input_name, output_name, net)]


@NodeFactory.register("NCNN", "Upscale Image")
class NcnnUpscaleImageNode(NodeBase):
    """NCNN node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Upscale an image with NCNN. Unlike PyTorch, NCNN has GPU support on all devices, assuming your drivers support Vulkan."
        self.inputs = [NcnnNetInput(), ImageInput()]
        self.outputs = [ImageOutput()]
        self.icon = "NCNN"
        self.sub = "NCNN"

    def run(self, net_tuple: tuple, img: np.ndarray) -> np.ndarray:
        dtype_max = 1
        try:
            dtype_max = np.iinfo(img.dtype).max
        except:
            logger.info("img dtype is not an int")

        img = (img.astype("float32") / dtype_max * 255).astype(
            np.uint8
        )  # don't ask lol

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

        param_path, bin_path, input_name, output_name, net = net_tuple

        # Try/except block to catch errors
        try:
            output, _ = ncnn_auto_split_process(
                img, net, input_name=input_name, output_name=output_name
            )
            # net.clear() # don't do this, it makes chaining break
            if gray:
                output = np.average(output, axis=2)
            return np.clip(output.astype(np.float32) / 255, 0, 1)
        except Exception as e:
            logger.error(e)
            raise RuntimeError("An unexpected error occurred during NCNN processing.")
