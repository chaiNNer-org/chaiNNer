from __future__ import annotations

import numpy as np
import onnxruntime as ort
from sanic.log import logger

from api import NodeContext
from nodes.groups import Condition, if_group
from nodes.impl.onnx.auto_split import onnx_auto_split
from nodes.impl.onnx.model import OnnxModel
from nodes.impl.onnx.session import get_onnx_session
from nodes.impl.onnx.utils import get_input_shape, get_output_shape
from nodes.impl.upscale.auto_split_tiles import (
    TILE_SIZE_256,
    TileSize,
    parse_tile_size_input,
)
from nodes.impl.upscale.convenient_upscale import convenient_upscale
from nodes.impl.upscale.tiler import ExactTileSize
from nodes.properties.inputs import (
    BoolInput,
    ImageInput,
    OnnxGenericModelInput,
    TileSizeDropdown,
)
from nodes.properties.outputs import ImageOutput
from nodes.utils.utils import get_h_w_c

from ...settings import get_settings
from .. import processing_group


def upscale(
    img: np.ndarray,
    session: ort.InferenceSession,
    tile_size: TileSize,
    change_shape: bool,
    exact_size: tuple[int, int] | None,
) -> np.ndarray:
    logger.debug("Upscaling image")

    if exact_size is None:

        def estimate():
            raise ValueError

        tiler = parse_tile_size_input(tile_size, estimate)
    else:
        tiler = ExactTileSize(exact_size)

    return onnx_auto_split(img, session, change_shape=change_shape, tiler=tiler)


@processing_group.register(
    schema_id="chainner:onnx:upscale_image",
    description=(
        "使用 ONNX 超分辨率模型对图像进行放大。ONNX 不支持通过自动平铺进行的内存不足处理。"
        "因此，您必须手动设置智能平铺模式。如果出现内存不足错误，请尝试选择列表中的更低设置。"
    ),
    inputs=[
        ImageInput().with_id(1),
        OnnxGenericModelInput().with_id(0),
        TileSizeDropdown(estimate=False, default=TILE_SIZE_256)
        .with_id(2)
        .with_docs(
            "使用平铺放大可允许放大大型图像而无需触及内存限制。",
            "这通过将图像分割成瓦片（有重叠），单独放大每个瓦片，然后无缝地重新组合它们来实现。",
            "通常建议为获得最佳性能使用最大的瓦片尺寸，但根据模型和图像大小，这可能不可行。",
            "ONNX 放大不支持自动模式，这意味着您可能需要手动选择瓦片大小才能使其正常工作。",
        ),
        if_group(Condition.type(1, "Image { channels: 4 } "))(
            BoolInput("分离 Alpha 通道", default=False).with_docs(
                "将 alpha 通道与颜色分开放大。启用此选项将使放大后的图像的 alpha 通道噪声较小，"
                "并更准确地反映原始图像的 alpha 通道，但图像可能会在透明度边缘附近出现暗边"
                "（从完全透明到完全不透明的过渡处）。",
                "是否启用此选项将改善放大后的图像取决于原始图像。通常建议对于在透明和不透明"
                "区域之间具有平滑过渡的图像启用此选项。",
            )
        ),
    ],
    outputs=[ImageOutput("图像")],
    name="放大图像",
    icon="ONNX",
    node_context=True,
)
def upscale_image_node(
    context: NodeContext,
    img: np.ndarray,
    model: OnnxModel,
    tile_size: TileSize,
    separate_alpha: bool,
) -> np.ndarray:
    settings = get_settings(context)
    session = get_onnx_session(
        model,
        settings.gpu_index,
        settings.execution_provider,
        settings.tensorrt_fp16_mode,
        settings.tensorrt_cache_path,
    )

    input_shape, in_nc, req_width, req_height = get_input_shape(session)
    _, out_nc, _, _ = get_output_shape(session)
    change_shape = input_shape == "BHWC"

    exact_size = None
    if req_width is not None:
        exact_size = req_width, req_height or req_width
    elif req_height is not None:
        exact_size = req_width or req_height, req_height

    h, w, c = get_h_w_c(img)
    logger.debug(f"Image is {h}x{w}x{c}")

    return convenient_upscale(
        img,
        in_nc,
        out_nc,
        lambda i: upscale(i, session, tile_size, change_shape, exact_size),
        separate_alpha,
    )
