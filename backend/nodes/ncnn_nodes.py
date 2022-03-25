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

    def upscale(self, img: np.ndarray, net: tuple, input_name: str, output_name: str):
        # Try/except block to catch errors
        try:
            vkdev = ncnn.get_gpu_device(0)
            blob_vkallocator = ncnn.VkBlobAllocator(vkdev)
            staging_vkallocator = ncnn.VkStagingAllocator(vkdev)
            output, _ = ncnn_auto_split_process(
                img,
                net,
                input_name=input_name,
                output_name=output_name,
                blob_vkallocator=blob_vkallocator,
                staging_vkallocator=staging_vkallocator,
            )
            # blob_vkallocator.clear() # this slows stuff down
            # staging_vkallocator.clear() # as does this
            # net.clear() # don't do this, it makes chaining break
            return output
        except Exception as e:
            logger.error(e)
            raise RuntimeError("An unexpected error occurred during NCNN processing.")

    def run(self, net_tuple: tuple, img: np.ndarray) -> np.ndarray:

        h, w = img.shape[:2]
        c = img.shape[2] if len(img.shape) > 2 else 1

        param_path, bin_path, input_name, output_name, net = net_tuple

        # ncnn only supports 3 apparently
        in_nc = 3

        # TODO: This can prob just be a shared function tbh
        # Transparency hack (white/black background difference alpha)
        if in_nc == 3 and c == 4:
            # NCNN expects RGB
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2RGBA)
            # Ignore single-color alpha
            unique = np.unique(img[:, :, 3])
            if len(unique) == 1:
                logger.info("Single color alpha channel, ignoring.")
                output = self.upscale(img[:, :, :3], net, input_name, output_name)
                output = np.dstack((output, np.full(output.shape[:-1], (unique[0]))))
            else:
                img1 = np.copy(img[:, :, :3])
                img2 = np.copy(img[:, :, :3])
                for c in range(3):
                    img1[:, :, c] *= img[:, :, 3]
                    img2[:, :, c] = (img2[:, :, c] - 1) * img[:, :, 3] + 1

                output1 = self.upscale(img1, net, input_name, output_name)
                output2 = self.upscale(img2, net, input_name, output_name)
                alpha = 1 - np.mean(output2 - output1, axis=2)
                output = np.dstack((output1, alpha))
        else:
            gray = False
            if img.ndim == 2:
                gray = True
                logger.debug("Expanding image channels")
                img = np.tile(np.expand_dims(img, axis=2), (1, 1, min(in_nc, 3)))
            # Remove extra channels if too many (i.e three channel image, single channel model)
            elif img.shape[2] > in_nc:
                logger.warn("Truncating image channels")
                img = img[:, :, :in_nc]
            # Pad with solid alpha channel if needed (i.e three channel image, four channel model)
            elif img.shape[2] == 3 and in_nc == 4:
                logger.debug("Expanding image channels")
                img = np.dstack((img, np.full(img.shape[:-1], 1.0)))
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            output = self.upscale(img, net, input_name, output_name)

            if gray:
                output = np.average(output, axis=2)

        if output.ndim > 2:
            if output.shape[2] == 4:
                output = cv2.cvtColor(output, cv2.COLOR_BGRA2RGBA)
            elif output.shape[2] == 3:
                output = cv2.cvtColor(output, cv2.COLOR_RGB2BGR)

        output = np.clip(output, 0, 1)

        return output
