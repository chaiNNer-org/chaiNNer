from __future__ import annotations

from contextlib import contextmanager

import cv2
import numpy as np

try:
    from ncnn_vulkan import ncnn

    use_gpu = True
except ImportError:
    from ncnn import ncnn

    use_gpu = False
from sanic.log import logger

from nodes.impl.ncnn.auto_split import ncnn_auto_split
from nodes.impl.ncnn.model import NcnnModelWrapper
from nodes.impl.ncnn.session import get_ncnn_net
from nodes.impl.upscale.auto_split_tiles import (
    TileSize,
    estimate_tile_size,
    parse_tile_size_input,
)
from nodes.impl.upscale.convenient_upscale import convenient_upscale
from nodes.impl.upscale.tiler import MaxTileSize
from nodes.properties.inputs import ImageInput, NcnnModelInput, TileSizeDropdown
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c
from system import is_mac

from ...settings import get_settings
from .. import processing_group


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


def upscale_impl(
    img: np.ndarray,
    model: NcnnModelWrapper,
    input_name: str,
    output_name: str,
    tile_size: TileSize,
):
    settings = get_settings()
    net = get_ncnn_net(model, settings.gpu_index)
    # Try/except block to catch errors
    try:
        if use_gpu:
            vkdev = ncnn.get_gpu_device(settings.gpu_index)

            def estimate_gpu():
                if is_mac:
                    # the actual estimate frequently crashes on mac, so we just use 256
                    return MaxTileSize(256)

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
                    tiler=parse_tile_size_input(tile_size, estimate_gpu),
                )
        else:

            def estimate_cpu():
                # TODO: Improve tile size estimation in CPU mode.
                raise ValueError(
                    "Tile size estimation not supported with NCNN CPU inference"
                )

            return ncnn_auto_split(
                img,
                net,
                input_name=input_name,
                output_name=output_name,
                blob_vkallocator=None,
                staging_vkallocator=None,
                tiler=parse_tile_size_input(tile_size, estimate_cpu),
            )
    except (RuntimeError, ValueError):
        raise
    except Exception as e:
        logger.error(e)
        # pylint: disable=raise-missing-from
        raise RuntimeError("An unexpected error occurred during NCNN processing.")


@processing_group.register(
    schema_id="chainner:ncnn:upscale_image",
    name="Upscale Image",
    description="Upscale an image with NCNN. Unlike PyTorch, NCNN has GPU support on all devices, assuming your drivers support Vulkan. \
            Select a manual number of tiles if you are having issues with the automatic mode.",
    icon="NCNN",
    inputs=[
        ImageInput().with_id(1),
        NcnnModelInput().with_id(0),
        TileSizeDropdown()
        .with_id(2)
        .with_docs(
            "Tiled upscaling is used to allow large images to be upscaled without hitting memory limits.",
            "This works by splitting the image into tiles (with overlap), upscaling each tile individually, and seamlessly recombining them.",
            "Generally it's recommended to use the largest tile size possible for best performance (with the ideal scenario being no tiling at all), but depending on the model and image size, this may not be possible.",
            "If you are having issues with the automatic mode, you can manually select a tile size. On certain machines, a very small tile size such as 256 or 128 might be required for it to work at all.",
        ),
    ],
    outputs=[
        ImageOutput(image_type="""convenientUpscale(Input0, Input1)"""),
    ],
    limited_to_8bpc=True,
)
def upscale_image_node(
    img: np.ndarray, model: NcnnModelWrapper, tile_size: TileSize
) -> np.ndarray:
    def upscale(i: np.ndarray) -> np.ndarray:
        ic = get_h_w_c(i)[2]
        if ic == 3:
            i = cv2.cvtColor(i, cv2.COLOR_BGR2RGB)
        elif ic == 4:
            i = cv2.cvtColor(i, cv2.COLOR_BGRA2RGBA)
        i = upscale_impl(
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
