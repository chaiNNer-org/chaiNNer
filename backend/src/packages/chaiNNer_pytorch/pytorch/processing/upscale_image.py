from __future__ import annotations

import numpy as np
import psutil
import torch
from sanic.log import logger
from spandrel import ImageModelDescriptor, ModelTiling

from api import NodeContext
from nodes.groups import Condition, if_group
from nodes.impl.pytorch.auto_split import pytorch_auto_split
from nodes.impl.upscale.auto_split_tiles import (
    NO_TILING,
    TileSize,
    estimate_tile_size,
    parse_tile_size_input,
)
from nodes.impl.upscale.convenient_upscale import convenient_upscale
from nodes.impl.upscale.tiler import MaxTileSize
from nodes.properties.inputs import (
    BoolInput,
    ImageInput,
    SrModelInput,
    TileSizeDropdown,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from ...settings import PyTorchSettings, get_settings
from .. import processing_group


def upscale(
    img: np.ndarray,
    model: ImageModelDescriptor,
    tile_size: TileSize,
    options: PyTorchSettings,
):
    with torch.no_grad():
        # Borrowed from iNNfer
        logger.debug("Upscaling image")

        # TODO: use bfloat16 if RTX
        use_fp16 = options.use_fp16 and model.supports_half
        device = options.device

        if model.tiling == ModelTiling.INTERNAL:
            # disable tiling if the model already does it internally
            tile_size = NO_TILING

        def estimate():
            element_size = 2 if use_fp16 else 4
            model_bytes = sum(
                p.numel() * element_size for p in model.model.parameters()
            )

            if "cuda" in device.type:
                mem_info: tuple[int, int] = torch.cuda.mem_get_info(device)  # type: ignore
                free, _total = mem_info
                element_size = 2 if use_fp16 else 4
                if options.budget_limit > 0:
                    free = min(options.budget_limit * 1024**3, free)
                budget = int(free * 0.8)

                return MaxTileSize(
                    estimate_tile_size(
                        budget,
                        model_bytes,
                        img,
                        element_size,
                    )
                )
            elif device.type == "cpu":
                free = psutil.virtual_memory().available
                if options.budget_limit > 0:
                    free = min(options.budget_limit * 1024**3, free)
                budget = int(free * 0.8)
                return MaxTileSize(
                    estimate_tile_size(
                        budget,
                        model_bytes,
                        img,
                        element_size,
                    )
                )
            return MaxTileSize()

        img_out = pytorch_auto_split(
            img,
            model=model,
            device=device,
            use_fp16=use_fp16,
            tiler=parse_tile_size_input(tile_size, estimate),
        )
        logger.debug("完成升级")

        return img_out


@processing_group.register(
    schema_id="chainner:pytorch:upscale_image",
    name="图像放大",
    description=(
        "使用 PyTorch 超分辨率模型对图像进行放大。如果使用自动模式时出现问题，请选择手动的瓦片数量。"
    ),
    icon="PyTorch",
    inputs=[
        ImageInput().with_id(1),
        SrModelInput().with_id(0),
        if_group(
            Condition.type(
                0,
                "PyTorchModel { tiling: ModelTiling::Supported | ModelTiling::Discouraged } ",
                if_not_connected=True,
            )
        )(
            TileSizeDropdown()
            .with_id(2)
            .with_docs(
                "使用瓦片放大可以使大图像在不触及内存限制的情况下进行放大。",
                "这通过将图像分割成瓦片（带有重叠部分），分别对每个瓦片进行放大，然后无缝地重新组合它们来实现。",
                "通常建议在性能最佳的情况下使用尽可能大的瓦片大小（理想情况下根本不进行瓦片），"
                "但根据模型和图像大小，这可能是不可能的。",
                "如果使用自动模式时遇到问题，可以手动选择瓦片大小。有时，手动选择的瓦片大小可能比自动模式选择的速度更快。",
                hint=True,
            ),
        ),
        if_group(
            Condition.type(1, "Image { channels: 4 } ")
            & (
                Condition.type(
                    0, "PyTorchModel { inputChannels: 1, outputChannels: 1 }"
                )
                | Condition.type(
                    0, "PyTorchModel { inputChannels: 3, outputChannels: 3 }"
                )
            )
        )(
            BoolInput("分离 Alpha 通道", default=False).with_docs(
                "将 alpha 通道与颜色分开进行放大。启用此选项将使放大图像的 alpha 通道噪声更少，更准确地反映原始图像的 alpha 通道，"
                "但图像可能在透明边缘附近出现暗边（从完全透明到完全不透明的过渡）。",
                "是否启用此选项将改进放大图像取决于原始图像。通常我们建议对具有平滑过渡的透明和不透明区域的图像启用此选项。",
            )
        ),
    ],
    outputs=[
        ImageOutput(
            "Image",
            image_type="""convenientUpscale(Input0, Input1)""",
            assume_normalized=True,  # pytorch_auto_split already does clipping internally
        )
    ],
    node_context=True,
)
def upscale_image_node(
    context: NodeContext,
    img: np.ndarray,
    model: ImageModelDescriptor,
    tile_size: TileSize,
    separate_alpha: bool,
) -> np.ndarray:
    exec_options = get_settings(context)

    logger.debug("放大图像...")

    in_nc = model.input_channels
    out_nc = model.output_channels
    scale = model.scale
    h, w, c = get_h_w_c(img)
    logger.debug(
        f"使用 {scale}x 模型放大 {h}x{w}x{c} 图像 (in_nc: {in_nc}, out_nc:"
        f" {out_nc})"
    )

    return convenient_upscale(
        img,
        in_nc,
        out_nc,
        lambda i: upscale(i, model, tile_size, exec_options),
        separate_alpha,
        clip=False,  # pytorch_auto_split already does clipping internally
    )
