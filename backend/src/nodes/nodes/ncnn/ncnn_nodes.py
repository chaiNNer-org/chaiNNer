"""
Nodes that provide NCNN support
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Tuple

import numpy as np
import cv2
from ncnn_vulkan import ncnn
from sanic.log import logger

from ...categories import NCNNCategory

# NCNN Save Model node
# pylint: disable=unused-import
from ...model_save_nodes import NcnnSaveNode
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import *
from ...properties.outputs import *
from ...utils.exec_options import get_execution_options
from ...utils.ncnn_auto_split import ncnn_auto_split_process
from ...utils.ncnn_model import NcnnModel
from ...utils.ncnn_session import get_ncnn_net
from ...utils.utils import convenient_upscale, get_h_w_c


@contextmanager
def managed_blob_vkallocator(vkdev: ncnn.VulkanDevice):
    try:
        blob_vkallocator = vkdev.acquire_blob_allocator()
    except:
        blob_vkallocator = ncnn.VkBlobAllocator(vkdev)
    try:
        yield blob_vkallocator
    finally:
        blob_vkallocator.clear()


@contextmanager
def ncnn_allocators(vkdev: ncnn.VulkanDevice):
    with managed_blob_vkallocator(vkdev) as blob_vkallocator:
        try:
            staging_vkallocator = vkdev.acquire_staging_allocator()
        except:
            staging_vkallocator = ncnn.VkStagingAllocator(vkdev)
        try:
            yield blob_vkallocator, staging_vkallocator
        finally:
            staging_vkallocator.clear()


@NodeFactory.register("chainner:ncnn:load_model")
class NcnnLoadModelNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Load NCNN model (.bin and .param files)."
        self.inputs = [ParamFileInput(), BinFileInput()]
        self.outputs = [NcnnModelOutput(), TextOutput("Model Name")]

        self.category = NCNNCategory
        self.name = "Load Model"
        self.icon = "NCNN"
        self.sub = "Input & Output"

    def run(self, param_path: str, bin_path: str) -> Tuple[NcnnModel, str]:
        model = NcnnModel.load_from_file(param_path, bin_path)
        model_name = os.path.splitext(os.path.basename(param_path))[0]

        return model, model_name


@NodeFactory.register("chainner:ncnn:upscale_image")
class NcnnUpscaleImageNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Upscale an image with NCNN. Unlike PyTorch, NCNN has GPU support on all devices, assuming your drivers support Vulkan. \
            Select a manual number of tiles if you are having issues with the automatic mode."
        self.inputs = [
            NcnnModelInput(),
            ImageInput(),
            TileModeDropdown(),
        ]
        self.outputs = [
            ImageOutput(image_type=expression.Image(channels="Input1.channels"))
        ]
        self.category = NCNNCategory
        self.name = "Upscale Image"
        self.icon = "NCNN"
        self.sub = "Processing"

    def upscale(
        self,
        img: np.ndarray,
        net,
        input_name: str,
        output_name: str,
        tile_mode: int,
    ):
        exec_options = get_execution_options()
        # Try/except block to catch errors
        try:
            vkdev = ncnn.get_gpu_device(exec_options.ncnn_gpu_index)
            # logger.info(vkdev.get_heap_budget())
            with ncnn_allocators(vkdev) as (
                blob_vkallocator,
                staging_vkallocator,
            ):
                output, _ = ncnn_auto_split_process(
                    img,
                    net,
                    input_name=input_name,
                    output_name=output_name,
                    blob_vkallocator=blob_vkallocator,
                    staging_vkallocator=staging_vkallocator,
                    max_depth=tile_mode if tile_mode > 0 else None,
                )
            # net.clear() # don't do this, it makes chaining break
            return output
        except ValueError as e:
            raise e
        except Exception as e:
            logger.error(e)
            # pylint: disable=raise-missing-from
            raise RuntimeError("An unexpected error occurred during NCNN processing.")

    def run(self, model: NcnnModel, img: np.ndarray, tile_mode: int) -> np.ndarray:
        exec_options = get_execution_options()
        net = get_ncnn_net(model, exec_options)

        model_c = model.get_model_in_nc()

        def upscale(i: np.ndarray) -> np.ndarray:
            ic = get_h_w_c(i)[2]
            if ic == 3:
                i = cv2.cvtColor(i, cv2.COLOR_BGR2RGB)
            elif ic == 4:
                i = cv2.cvtColor(i, cv2.COLOR_BGRA2RGBA)
            i = self.upscale(
                i,
                net,
                model.layer_list[0].outputs[0],
                model.layer_list[-1].outputs[0],
                tile_mode,
            )
            if ic == 3:
                i = cv2.cvtColor(i, cv2.COLOR_RGB2BGR)
            elif ic == 4:
                i = cv2.cvtColor(i, cv2.COLOR_RGBA2BGRA)
            return i

        return convenient_upscale(img, model_c, upscale)


@NodeFactory.register("chainner:ncnn:interpolate_models")
class NcnnInterpolateModelsNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = """Interpolate two NCNN models of the same type together. Note: models must share a common 'pretrained model' ancestor
             in order to be interpolatable."""
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
            NumberOutput("Amount A", "100 - Input2"),
            NumberOutput("Amount B", "Input2"),
        ]

        self.category = NCNNCategory
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
        self, model_a: NcnnModel, model_b: NcnnModel, amount: int
    ) -> Tuple[NcnnModel, int, int]:
        if amount == 0:
            return model_a, 100, 0
        elif amount == 100:
            return model_b, 0, 100

        f_amount = 1 - amount / 100
        interp_model = model_a.interpolate(model_b, f_amount)

        if not self.check_will_upscale(interp_model):
            raise ValueError(
                "These NCNN models are not compatible and not able to be interpolated together"
            )

        return interp_model, 100 - amount, amount
