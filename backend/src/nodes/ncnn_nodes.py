"""
Nodes that provide NCNN support
"""
from __future__ import annotations

import os
import re
import struct
import tempfile
from typing import Tuple

import numpy as np
from ncnn_vulkan import ncnn
from sanic.log import logger

from .categories import NCNN
from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.ncnn_auto_split import ncnn_auto_split_process
from .utils.ncnn_parsers import FLAG_FLOAT_16, FLAG_FLOAT_32, parse_ncnn_bin_from_buffer
from .utils.ncnn_structure import NcnnModel, interpolate_ncnn
from .utils.utils import get_h_w_c, convenient_upscale


class NcnnNetData:
    def __init__(
        self,
        param_path: str,
        bin_data: np.ndarray,
        input_name: str,
        output_name: str,
    ):
        self.param_path = param_path
        self.bin_data = bin_data
        self.input_name = input_name
        self.output_name = output_name


@NodeFactory.register("chainner:ncnn:load_model")
class NcnnLoadModelNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Load NCNN model (.bin and .param files)."
        self.inputs = [ParamFileInput(), BinFileInput()]
        self.outputs = [NcnnNetOutput(), TextOutput("Model Name")]

        self.category = NCNN
        self.name = "Load Model"
        self.icon = "NCNN"
        self.sub = "Input & Output"

    def get_param_info(self, param_path):
        input_name = "data"
        output_name = "output"
        out_nc = 3

        with open(param_path, encoding="utf-8") as f:
            lines = f.read()

            assert (
                not "MemoryData" in lines
            ), "This NCNN param file contains invalid layers"

            # # Scale
            # regex = 'Interp\s*\w*\s*.*2=(\d.?\d*)'
            # matches = re.findall(regex, lines)
            # scale = int(np.prod([float(n) for n in matches]))

            # Input name
            regex = r"Input\s+([\w.]+)\s+0\s1\s(\w+)"
            matches = re.findall(regex, lines)
            if len(matches) > 0:
                if any(isinstance(el, tuple) for el in matches):
                    matches = matches[-1]
                _, input_name = matches

            # Output name & out nc
            # regex = '\w+\s+([\w.]+)\s+\d+\s+\d+\s+\d+\s+([^\d\s]+)\s0=(\d)'
            regex = r"\s([^\s]+)\s0=(\d)"
            matches = re.findall(regex, lines)
            if len(matches) > 0:
                if any(isinstance(el, tuple) for el in matches):
                    matches = matches[-1]
                output_name, out_nc = matches
        logger.info(f"{input_name}, {output_name}, {out_nc}")

        return input_name, output_name, out_nc

    def run(self, param_path: str, bin_path: bytes) -> Tuple[NcnnNetData, str]:
        assert os.path.exists(
            param_path
        ), f"Param file at location {param_path} does not exist"
        assert os.path.exists(
            bin_path
        ), f"Bin file at location {param_path} does not exist"

        assert os.path.isfile(param_path), f"Path {param_path} is not a file"
        assert os.path.isfile(bin_path), f"Path {param_path} is not a file"

        input_name, output_name, _out_nc = self.get_param_info(param_path)

        with open(bin_path, "rb") as f:
            bin_file_data = f.read()
        bin_data = parse_ncnn_bin_from_buffer(bin_file_data)

        model_name = os.path.splitext(os.path.basename(param_path))[0]

        # Put all this info with the net and disguise it as just the net
        return NcnnNetData(param_path, bin_data, input_name, output_name), model_name


@NodeFactory.register("chainner:ncnn:save_model")
class NcnnSaveNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Save an NCNN model to specified directory."
        self.inputs = [NcnnModelInput(), DirectoryInput(), TextInput("Param/Bin Name")]
        self.outputs = []

        self.category = NCNN
        self.name = "Save Model"
        self.icon = "MdSave"
        self.sub = "Input & Output"

        self.side_effects = True

    def run(self, net: NcnnModel, directory: str, name: str) -> bool:
        full_bin = f"{name}.bin"
        full_param = f"{name}.param"
        full_bin_path = os.path.join(directory, full_bin)
        full_param_path = os.path.join(directory, full_param)

        logger.info(f"Writing NCNN model to paths: {full_bin_path} {full_param_path}")
        net.write_bin(full_bin_path)
        net.write_param(full_param_path)

        return True


@NodeFactory.register("chainner:ncnn:upscale_image")
class NcnnUpscaleImageNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Upscale an image with NCNN. Unlike PyTorch, NCNN has GPU support on all devices, assuming your drivers support Vulkan."
        self.inputs = [
            NcnnNetInput(),
            ImageInput(),
            NumberInput("Tile Size Target", default=0, minimum=0, maximum=None),
        ]
        self.outputs = [
            ImageOutput(
                image_type=expression.Image(
                    channels="getUpscaleChannels(Input1.channels, 3, 3)"
                )
            )
        ]
        self.category = NCNN
        self.name = "Upscale Image"
        self.icon = "NCNN"
        self.sub = "Processing"

    def upscale(
        self,
        img: np.ndarray,
        net,
        input_name: str,
        output_name: str,
        split_factor: Union[int, None],
    ):
        # Try/except block to catch errors
        try:
            vkdev = ncnn.get_gpu_device(ncnn.get_default_gpu_index())
            blob_vkallocator = ncnn.VkBlobAllocator(vkdev)
            staging_vkallocator = ncnn.VkStagingAllocator(vkdev)
            output, _ = ncnn_auto_split_process(
                img,
                net,
                input_name=input_name,
                output_name=output_name,
                blob_vkallocator=blob_vkallocator,
                staging_vkallocator=staging_vkallocator,
                max_depth=split_factor,
            )
            # blob_vkallocator.clear() # this slows stuff down
            # staging_vkallocator.clear() # as does this
            # net.clear() # don't do this, it makes chaining break
            return output
        except Exception as e:
            logger.error(e)
            # pylint: disable=raise-missing-from
            raise RuntimeError("An unexpected error occurred during NCNN processing.")

    def run(
        self, net_data: NcnnNetData, img: np.ndarray, tile_size_target: int
    ) -> np.ndarray:
        h, w, _ = get_h_w_c(img)

        if tile_size_target > 0:
            # Calculate split factor using a tile size target
            # Example: w == 1280, tile_size_target == 512
            # 1280 / 512 = 2.5, ceil makes that 3, so split_factor == 3
            # This effectively makes the tile size for the image 426
            w_split_factor = int(np.ceil(w / tile_size_target))
            h_split_factor = int(np.ceil(h / tile_size_target))
            split_factor = max(w_split_factor, h_split_factor, 1)
        else:
            split_factor = None

        net = ncnn.Net()

        # Use vulkan compute
        net.opt.use_vulkan_compute = True
        net.set_vulkan_device(ncnn.get_default_gpu_index())

        # Load model param and bin
        net.load_param(net_data.param_path)

        with tempfile.TemporaryDirectory(prefix="chaiNNer-") as tempdir:
            is_fp16 = net_data.bin_data.dtype == np.float16
            flag = FLAG_FLOAT_16 if is_fp16 else FLAG_FLOAT_32
            dtype = np.float16 if is_fp16 else np.float32
            packed = struct.pack("<I", flag) + net_data.bin_data.astype(dtype).tobytes(
                "F"
            )
            temp_file = os.path.join(tempdir, "ncnn.bin")
            with open(temp_file, "wb") as binary_file:
                binary_file.write(packed)
            net.load_model(temp_file)

        def upscale(i: np.ndarray) -> np.ndarray:
            i = cv2.cvtColor(i, cv2.COLOR_BGR2RGB)
            i = self.upscale(
                i, net, net_data.input_name, net_data.output_name, split_factor
            )
            assert (
                get_h_w_c(i)[2] == 3
            ), "Chainner only supports upscaling with NCNN models that output RGB images."
            return cv2.cvtColor(i, cv2.COLOR_RGB2BGR)

        return convenient_upscale(img, 3, upscale)


@NodeFactory.register("chainner:ncnn:interpolate_models")
class NcnnInterpolateModelsNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Interpolate two NCNN models of the same type together."
        self.inputs = [
            NcnnModelInput("Model A"),
            NcnnModelInput("Model B"),
            SliderInput(
                "Weights",
                controls_step=5,
                slider_step=1,
                maximum=100,
                default=50,
                unit="%",
                note_expression="`Model A ${100 - value}% ― Model B ${value}%`",
                ends=("A", "B"),
            ),
        ]
        self.outputs = [
            NcnnModelOutput(),
            NumberOutput("Amount A", "subtract(100, Input2)"),
            NumberOutput("Amount B", "Input2"),
        ]

        self.category = NCNN
        self.name = "Interpolate Models"
        self.icon = "BsTornado"
        self.sub = "Utility"

    def run(
        self, a: NcnnModel, b: NcnnModel, amount: int
    ) -> Tuple[NcnnModel, int, int]:
        f_amount = 1 - amount / 100
        return (interpolate_ncnn(a, b, f_amount), 100 - amount, amount)

    """def perform_interp(self, bin_a: np.ndarray, bin_b: np.ndarray, amount: int):
        is_fp16 = bin_a.dtype == np.float16
        try:
            amount_b = amount / 100
            amount_a = 1 - amount_b

            bin_a_mult = bin_a.astype(np.float64) * amount_a
            bin_b_mult = bin_b.astype(np.float64) * amount_b
            result = bin_a_mult + bin_b_mult

            return result.astype(np.float16 if is_fp16 else np.float32)
        except:
            # pylint: disable=raise-missing-from
            raise ValueError(
                "These models are not compatible and able not able to be interpolated together"
            )

    def check_can_interp(self, a: NcnnNetData, b: NcnnNetData):
        interp_50 = self.perform_interp(a.bin_data, b.bin_data, 50)
        fake_img = np.ones((3, 3, 3), dtype=np.float32, order="F")
        new_net = NcnnNetData(a.param_path, interp_50, a.input_name, a.output_name)
        result = NcnnUpscaleImageNode().run(new_net, fake_img, 0)
        del interp_50, new_net

        mean_color = np.mean(result)
        del result
        return mean_color > 0.5

    def run(
        self, a: NcnnNetData, b: NcnnNetData, amount: int
    ) -> Tuple[NcnnNetData, int, int]:
        logger.info(len(a.bin_data))
        logger.info(len(b.bin_data))
        assert len(a.bin_data) == len(
            b.bin_data
        ), "The provided model bins are not compatible as they are not the same size."
        assert (
            a.bin_data.dtype == b.bin_data.dtype
        ), "The provided model bins are not compatible as they are not the same datatype."

        logger.info(f"Interpolating NCNN models...")
        if not self.check_can_interp(a, b):
            raise ValueError(
                "These NCNN models are not compatible and not able to be interpolated together"
            )

        interp_bin_data = self.perform_interp(a.bin_data, b.bin_data, amount)

        # Put all this info with the net and disguise it as just the net
        return (
            NcnnNetData(a.param_path, interp_bin_data, a.input_name, a.output_name),
            100 - amount,
            amount,
        )"""
