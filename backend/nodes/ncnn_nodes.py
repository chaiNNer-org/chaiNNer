"""
Nodes that provide NCNN support
"""

import os
import re
import struct
import tempfile

import numpy as np
from ncnn_vulkan import ncnn
from sanic.log import logger

from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.ncnn_auto_split import ncnn_auto_split_process
from .utils.ncnn_parsers import FLAG_FLOAT_16, FLAG_FLOAT_32, parse_ncnn_bin_from_buffer


@NodeFactory.register("NCNN", "Load Model")
class NcnnLoadModelNode(NodeBase):
    """NCNN load model node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Load NCNN model (.bin and .param files)."
        self.inputs = [ParamFileInput(), BinFileInput()]
        self.outputs = [NcnnNetOutput(), TextOutput("Model Name")]
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

    def run(self, param_path: str, bin_path: bytes) -> Any:
        assert os.path.exists(
            param_path
        ), f"Param file at location {param_path} does not exist"
        assert os.path.exists(
            bin_path
        ), f"Bin file at location {param_path} does not exist"

        assert os.path.isfile(param_path), f"Path {param_path} is not a file"
        assert os.path.isfile(bin_path), f"Path {param_path} is not a file"

        input_name, output_name, out_nc = self.get_param_info(param_path)

        with open(bin_path, "rb") as f:
            bin_file_data = f.read()
        bin_data = parse_ncnn_bin_from_buffer(bin_file_data)

        model_name = os.path.splitext(os.path.basename(param_path))[0]

        # Put all this info with the net and disguise it as just the net
        return (param_path, bin_data, input_name, output_name), model_name


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

        param_path, bin_data, input_name, output_name = net_tuple

        net = ncnn.Net()

        # Use vulkan compute
        net.opt.use_vulkan_compute = True
        net.set_vulkan_device(ncnn.get_default_gpu_index())

        # Load model param and bin
        net.load_param(param_path)

        bin_is_fp16 = bin_data.dtype == "float16"

        with tempfile.TemporaryDirectory(prefix="chaiNNer-") as tempdir:
            bin_file_data = struct.pack(
                "<I",
                (
                    FLAG_FLOAT_16
                    if bin_is_fp16 or os.environ["isFp16"]
                    else FLAG_FLOAT_32
                ),
            ) + bin_data.astype(
                np.float16 if bin_is_fp16 or os.environ["isFp16"] else np.float32
            ).tobytes(
                "F"
            )
            temp_file = os.path.join(tempdir, "ncnn.bin")
            with open(temp_file, "wb") as binary_file:
                binary_file.write(bin_file_data)
            net.load_model(temp_file)

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


@NodeFactory.register("NCNN", "Interpolate Models")
class NcnnInterpolateModelsNode(NodeBase):
    """NCNN interpolate models node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Interpolate two NCNN models of the same type together."
        self.inputs = [
            NcnnNetInput("Net A"),
            NcnnNetInput("Net B"),
            SliderInput("Amount", 0, 100, 50),
        ]
        self.outputs = [NcnnNetOutput()]

        self.icon = "BsTornado"
        self.sub = "Utility"

    def perform_interp(self, bin_a: np.ndarray, bin_b: np.ndarray, amount: int):
        try:
            amount_a = amount / 100
            amount_b = 1 - amount_a

            bin_a_mult = bin_a * amount_a
            bin_b_mult = bin_b * amount_b
            result = bin_a_mult + bin_b_mult
            return result
        except Exception as e:
            raise ValueError(
                "These models are not compatible and able not able to be interpolated together"
            )

    def check_can_interp(self, bin_a: np.ndarray, bin_b: np.ndarray, net_tuple_a):
        param_path_a, _, input_name_a, output_name_a = net_tuple_a
        interp_50 = self.perform_interp(bin_a, bin_b, 50)
        fake_img = np.ones((3, 3, 3), dtype=np.float32)
        new_net_tuple = (param_path_a, interp_50, input_name_a, output_name_a)
        result = NcnnUpscaleImageNode().run(new_net_tuple, fake_img)
        del interp_50, new_net_tuple
        logger.info(result)
        mean_color = np.mean(result)
        del result
        return mean_color > 0.5

    def run(self, net_tuple_a: tuple, net_tuple_b: tuple, amount: str) -> Any:

        param_path_a, bin_data_a, input_name_a, output_name_a = net_tuple_a
        param_path_b, bin_data_b, input_name_b, output_name_b = net_tuple_b

        logger.info(len(bin_data_a))
        logger.info(len(bin_data_b))
        assert len(bin_data_a) == len(
            bin_data_b
        ), "The provided model bins are not compatible."

        logger.info(f"Interpolating NCNN models...")
        if not self.check_can_interp(bin_data_a, bin_data_b, net_tuple_a):
            raise ValueError(
                "These NCNN models are not compatible and not able to be interpolated together"
            )

        interp_bin_data = self.perform_interp(bin_data_a, bin_data_b, int(amount))

        # Put all this info with the net and disguise it as just the net
        return [(param_path_a, interp_bin_data, input_name_a, output_name_a)]


@NodeFactory.register("NCNN", "Save Model")
class NcnnSaveNode(NodeBase):
    """Model Save node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Save an NCNN model to specified directory."
        self.inputs = [NcnnNetInput(), DirectoryInput(), TextInput("Param/Bin Name")]
        self.outputs = []

        self.icon = "NCNN"
        self.sub = "NCNN"

    def run(self, net_tuple: tuple, directory: str, name: str) -> bool:
        param_path, bin_data, input_name, output_name = net_tuple
        full_bin = f"{name}.bin"
        full_param = f"{name}.param"
        full_bin_path = os.path.join(directory, full_bin)
        full_param_path = os.path.join(directory, full_param)

        logger.info(f"Writing NCNN model to paths: {full_bin_path} {full_param_path}")
        bin_is_fp16 = bin_data.dtype == "float16"
        bin_file_data = struct.pack(
            "<I",
            (FLAG_FLOAT_16 if bin_is_fp16 or os.environ["isFp16"] else FLAG_FLOAT_32),
        ) + bin_data.astype(
            np.float16 if bin_is_fp16 or os.environ["isFp16"] else np.float32
        ).tobytes(
            "F"
        )
        with open(full_bin_path, "wb") as binary_file:
            binary_file.write(bin_file_data)
        with open(full_param_path, "w") as param_file:
            with open(param_path, "r") as original_param_file:
                param_file.write(original_param_file)

        return True
