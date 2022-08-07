"""
Nodes that provide NCNN support
"""
from __future__ import annotations

import os
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
from .utils.ncnn_model import NcnnModel
from .utils.utils import get_h_w_c, convenient_upscale


@NodeFactory.register("chainner:ncnn:load_model")
class NcnnLoadModelNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Load NCNN model (.bin and .param files)."
        self.inputs = [ParamFileInput(), BinFileInput()]
        self.outputs = [NcnnModelOutput(), TextOutput("Model Name")]

        self.category = NCNN
        self.name = "Load Model"
        self.icon = "NCNN"
        self.sub = "Input & Output"

    def run(self, param_path: str, bin_path: str) -> Tuple[NcnnModel, str]:
        assert os.path.exists(
            param_path
        ), f"Param file at location {param_path} does not exist"
        assert os.path.exists(
            bin_path
        ), f"Bin file at location {bin_path} does not exist"

        assert os.path.isfile(param_path), f"Path {param_path} is not a file"
        assert os.path.isfile(bin_path), f"Path {bin_path} is not a file"

        model = NcnnModel()
        model.load_model(param_path, bin_path)
        with open(bin_path, "rb") as f:
            model.weights_bin = f.read()
        model_name = os.path.splitext(os.path.basename(param_path))[0]

        return model, model_name


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
            NcnnModelInput(),
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

    def get_model_channels(self, model: NcnnModel) -> int:
        num_filters = model.layer_list[1].params[0].value
        kernel_w = model.layer_list[1].params[1].value
        try:
            kernel_h = model.layer_list[1].params[11].value
        except KeyError:
            kernel_h = kernel_w
        weight_data_size = model.layer_list[1].params[6].value

        assert (
            isinstance(num_filters, int)
            and isinstance(kernel_w, int)
            and isinstance(kernel_h, int)
            and isinstance(weight_data_size, int)
        ), "Out nc, kernel width and height, and weight data size must all be ints"
        in_nc = weight_data_size // num_filters // kernel_w // kernel_h

        return in_nc

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
        self, model: NcnnModel, img: np.ndarray, tile_size_target: int
    ) -> np.ndarray:
        h, w, _ = get_h_w_c(img)
        model_c = self.get_model_channels(model)

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
        net.load_param_mem(model.write_param_to_mem())
        net.load_model_mem(model.weights_bin)

        def upscale(i: np.ndarray) -> np.ndarray:
            ic = get_h_w_c(i)[2]
            if ic == 3:
                i = cv2.cvtColor(i, cv2.COLOR_BGR2RGB)
            i = self.upscale(
                i,
                net,
                model.layer_list[0].outputs[0],
                model.layer_list[-1].outputs[0],
                split_factor,
            )
            if ic == 3:
                i = cv2.cvtColor(i, cv2.COLOR_RGB2BGR)
            return i

        return convenient_upscale(img, model_c, upscale)


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

    def check_will_upscale(self, interp: NcnnModel):
        fake_img = np.ones((3, 3, 3), dtype=np.float32, order="F")
        result = NcnnUpscaleImageNode().run(interp, fake_img, 0)

        mean_color = np.mean(result)
        del result
        return mean_color > 0.5

    def run(
        self, a: NcnnModel, b: NcnnModel, amount: int
    ) -> Tuple[NcnnModel, int, int]:
        f_amount = 1 - amount / 100
        interp_model = a.interpolate_ncnn(b, f_amount)

        if not self.check_will_upscale(interp_model):
            raise ValueError(
                "These NCNN models are not compatible and not able to be interpolated together"
            )

        return interp_model, 100 - amount, amount
