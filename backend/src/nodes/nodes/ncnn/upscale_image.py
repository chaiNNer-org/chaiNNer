from __future__ import annotations

from contextlib import contextmanager

import cv2
import numpy as np
from ncnn_vulkan import ncnn
from sanic.log import logger

from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput, NcnnModelInput, TileSizeDropdown
from ...properties.outputs import ImageOutput
from ...impl.upscale.auto_split import MaxTileSize
from ...impl.upscale.auto_split_tiles import (
    estimate_tile_size,
    parse_tile_size_input,
    TileSize,
)
from ...impl.upscale.convenient_upscale import convenient_upscale
from ...utils.exec_options import get_execution_options
from ...impl.ncnn.ncnn_auto_split import ncnn_auto_split
from ...impl.ncnn.ncnn_model import NcnnModelWrapper
from ...impl.ncnn.ncnn_session import get_ncnn_net
from ...utils.utils import get_h_w_c
from . import category as NCNNCategory


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


@NodeFactory.register("chainner:ncnn:upscale_image")
class NcnnUpscaleImageNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Upscale an image with NCNN. Unlike PyTorch, NCNN has GPU support on all devices, assuming your drivers support Vulkan. \
            Select a manual number of tiles if you are having issues with the automatic mode."
        self.inputs = [
            NcnnModelInput(),
            ImageInput(),
            TileSizeDropdown(),
        ]
        self.outputs = [
            ImageOutput(image_type="""convenientUpscale(Input0, Input1)"""),
        ]
        self.category = NCNNCategory
        self.name = "Upscale Image"
        self.icon = "NCNN"
        self.sub = "Processing"

    def upscale(
        self,
        img: np.ndarray,
        model: NcnnModelWrapper,
        input_name: str,
        output_name: str,
        tile_size: TileSize,
    ):
        exec_options = get_execution_options()
        net = get_ncnn_net(model, exec_options)
        # Try/except block to catch errors
        try:
            vkdev = ncnn.get_gpu_device(exec_options.ncnn_gpu_index)

            def estimate():
                heap_budget = vkdev.get_heap_budget() * 1024 * 1024 * 0.8
                return MaxTileSize(
                    estimate_tile_size(heap_budget, model.model.bin_length, img, 4)
                )

            with ncnn_allocators(vkdev) as (
                blob_vkallocator,
                staging_vkallocator,
            ):
                return ncnn_auto_split(
                    img,
                    net,
                    input_name=input_name,
                    output_name=output_name,
                    blob_vkallocator=blob_vkallocator,
                    staging_vkallocator=staging_vkallocator,
                    tiler=parse_tile_size_input(tile_size, estimate),
                )
        except (RuntimeError, ValueError):
            raise
        except Exception as e:
            logger.error(e)
            # pylint: disable=raise-missing-from
            raise RuntimeError("An unexpected error occurred during NCNN processing.")

    def run(
        self, model: NcnnModelWrapper, img: np.ndarray, tile_size: TileSize
    ) -> np.ndarray:
        def upscale(i: np.ndarray) -> np.ndarray:
            ic = get_h_w_c(i)[2]
            if ic == 3:
                i = cv2.cvtColor(i, cv2.COLOR_BGR2RGB)
            elif ic == 4:
                i = cv2.cvtColor(i, cv2.COLOR_BGRA2RGBA)
            i = self.upscale(
                i,
                model,
                model.model.layers[0].outputs[0],
                model.model.layers[-1].outputs[0],
                tile_size,
            )
            if ic == 3:
                i = cv2.cvtColor(i, cv2.COLOR_RGB2BGR)
            elif ic == 4:
                i = cv2.cvtColor(i, cv2.COLOR_RGBA2BGRA)
            return i

        return convenient_upscale(img, model.in_nc, model.out_nc, upscale)
