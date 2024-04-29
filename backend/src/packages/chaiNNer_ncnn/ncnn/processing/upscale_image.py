from __future__ import annotations

from contextlib import contextmanager

import cv2
import numpy as np

try:
    from ncnn_vulkan import ncnn

    use_gpu = True
except ImportError:
    from ncnn import ncnn  # type: ignore

    use_gpu = False
from sanic.log import logger

from api import NodeContext
from nodes.groups import Condition, if_enum_group, if_group
from nodes.impl.ncnn.auto_split import ncnn_auto_split
from nodes.impl.ncnn.model import NcnnModelWrapper
from nodes.impl.ncnn.session import get_ncnn_net
from nodes.impl.upscale.auto_split_tiles import (
    CUSTOM,
    TILE_SIZE_256,
    TileSize,
    estimate_tile_size,
    parse_tile_size_input,
)
from nodes.impl.upscale.convenient_upscale import convenient_upscale
from nodes.impl.upscale.tiler import MaxTileSize
from nodes.properties.inputs import (
    BoolInput,
    ImageInput,
    NcnnModelInput,
    NumberInput,
    TileSizeDropdown,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c
from system import is_mac

from ...settings import NcnnSettings, get_settings
from .. import processing_group


@contextmanager
def managed_blob_vkallocator(vkdev: ncnn.VulkanDevice):
    try:
        blob_vkallocator = vkdev.acquire_blob_allocator()
    except Exception:
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
        except Exception:
            staging_vkallocator = ncnn.VkStagingAllocator(vkdev)
        try:
            yield blob_vkallocator, staging_vkallocator
        finally:
            staging_vkallocator.clear()


def upscale_impl(
    settings: NcnnSettings,
    img: np.ndarray,
    model: NcnnModelWrapper,
    input_name: str,
    output_name: str,
    tile_size: TileSize,
):
    net = get_ncnn_net(model, settings=settings)
    # Try/except block to catch errors
    try:

        def estimate():
            heap_budget_bytes = settings.budget_limit * 1024**3

            # 0 means no limit, we approximate that here by picking 1 PiB,
            # which presumably no one will ever hit.
            if heap_budget_bytes == 0:
                heap_budget_bytes = 1024**5

            model_size_estimate = model.model.bin_length

            if use_gpu:
                if is_mac:
                    # the actual estimate frequently crashes on mac, so we just use 256
                    return MaxTileSize(256)

                heap_budget_bytes = min(
                    heap_budget_bytes, vkdev.get_heap_budget() * 1024 * 1024 * 0.8
                )
            else:
                # Empirically determined (TODO do a more thorough job here)
                model_size_estimate = model_size_estimate * 5 / 3
                if net.opt.use_winograd_convolution:
                    model_size_estimate = model_size_estimate * 11 / 5
                elif net.opt.use_sgemm_convolution:
                    model_size_estimate = model_size_estimate * 40 / 5

            return MaxTileSize(
                estimate_tile_size(heap_budget_bytes, int(model_size_estimate), img, 4)
            )

        if use_gpu:
            vkdev = ncnn.get_gpu_device(settings.gpu_index)

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
        else:
            return ncnn_auto_split(
                img,
                net,
                input_name=input_name,
                output_name=output_name,
                blob_vkallocator=None,
                staging_vkallocator=None,
                tiler=parse_tile_size_input(tile_size, estimate),
            )
    except (RuntimeError, ValueError):
        raise
    except Exception as e:
        logger.error(e)
        raise RuntimeError("An unexpected error occurred during NCNN processing.")  # noqa: B904


@processing_group.register(
    schema_id="chainner:ncnn:upscale_image",
    name="Upscale Image",
    description="Upscale an image with NCNN. Unlike PyTorch, NCNN has GPU support on all devices, assuming your drivers support Vulkan. \
            Select a manual number of tiles or set a memory budget limit if you are having issues with the automatic mode.",
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
            "If you are having issues with the automatic mode, you can manually select a tile size, or set a memory budget limit. On certain machines, a very small tile size such as 256 or 128 might be required for it to work at all.",
        ),
        if_enum_group(2, CUSTOM)(
            NumberInput(
                "Custom Tile Size",
                minimum=1,
                maximum=None,
                default=TILE_SIZE_256,
                precision=0,
                controls_step=1,
                unit="px",
                has_handle=False,
            )
        ),
        if_group(
            Condition.type(1, "Image { channels: 4 } ")
            & (
                Condition.type(0, "NcnnNetwork { inputChannels: 1, outputChannels: 1 }")
                | Condition.type(
                    0, "NcnnNetwork { inputChannels: 3, outputChannels: 3 }"
                )
            )
        )(
            BoolInput("Separate Alpha", default=False).with_docs(
                "Upscale alpha separately from color. Enabling this option will cause the alpha of"
                " the upscaled image to be less noisy and more accurate to the alpha of the original"
                " image, but the image may suffer from dark borders near transparency edges"
                " (transition from fully transparent to fully opaque).",
                "Whether enabling this option will improve the upscaled image depends on the original"
                " image. We generally recommend this option for images with smooth transitions between"
                " transparent and opaque regions.",
            )
        ),
    ],
    outputs=[
        ImageOutput(image_type="""convenientUpscale(Input0, Input1)"""),
    ],
    limited_to_8bpc=True,
    node_context=True,
)
def upscale_image_node(
    context: NodeContext,
    img: np.ndarray,
    model: NcnnModelWrapper,
    tile_size: TileSize,
    custom_tile_size: int | None,
    separate_alpha: bool,
) -> np.ndarray:
    settings = get_settings(context)

    def upscale(i: np.ndarray) -> np.ndarray:
        ic = get_h_w_c(i)[2]
        if ic == 3:
            i = cv2.cvtColor(i, cv2.COLOR_BGR2RGB)
        elif ic == 4:
            i = cv2.cvtColor(i, cv2.COLOR_BGRA2RGBA)
        i = upscale_impl(
            settings,
            i,
            model,
            model.model.layers[0].outputs[0],
            model.model.layers[-1].outputs[0],
            TileSize(custom_tile_size) if tile_size == CUSTOM else tile_size,
        )
        if ic == 3:
            i = cv2.cvtColor(i, cv2.COLOR_RGB2BGR)
        elif ic == 4:
            i = cv2.cvtColor(i, cv2.COLOR_RGBA2BGRA)
        return i

    return convenient_upscale(img, model.in_nc, model.out_nc, upscale, separate_alpha)
