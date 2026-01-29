from __future__ import annotations

from enum import Enum

from api import NodeContext
from logger import logger
from nodes.groups import Condition, if_enum_group
from nodes.impl.onnx.model import OnnxModel
from nodes.impl.tensorrt.engine_builder import BuildConfig, build_engine_from_onnx
from nodes.impl.tensorrt.model import TensorRTEngine
from nodes.properties.inputs import (
    EnumInput,
    NumberInput,
    OnnxModelInput,
)
from nodes.properties.outputs import TensorRTEngineOutput, TextOutput

from ...settings import get_settings
from .. import io_group


class Precision(Enum):
    FP32 = "fp32"
    FP16 = "fp16"


PRECISION_LABELS = {
    Precision.FP32: "FP32 (Higher Precision)",
    Precision.FP16: "FP16 (Faster on RTX GPUs)",
}


class ShapeMode(Enum):
    FIXED = "fixed"
    DYNAMIC = "dynamic"


SHAPE_MODE_LABELS = {
    ShapeMode.FIXED: "Fixed (Single Size)",
    ShapeMode.DYNAMIC: "Dynamic (Variable Sizes)",
}


if io_group is not None:

    @io_group.register(
        schema_id="chainner:tensorrt:build_engine",
        name="Build Engine from ONNX",
        description=[
            "Convert an ONNX model to a TensorRT engine.",
            "Building an engine can take several minutes depending on the model size and optimization settings.",
            "The built engine is optimized specifically for your GPU and TensorRT version.",
            "It is recommended to save the built engine for reuse, as building is slow.",
        ],
        icon="Nvidia",
        inputs=[
            OnnxModelInput("ONNX Model"),
            EnumInput(
                Precision,
                label="Precision",
                default=Precision.FP16,
                option_labels=PRECISION_LABELS,
            ).with_docs(
                "FP16 is faster on RTX GPUs and uses less VRAM.",
                "FP32 provides higher precision but is slower.",
            ),
            EnumInput(
                ShapeMode,
                label="Shape Mode",
                default=ShapeMode.FIXED,
                option_labels=SHAPE_MODE_LABELS,
            ).with_docs(
                "Fixed: Build engine for a single input size. Fastest inference.",
                "Dynamic: Build engine for variable input sizes. More flexible but slightly slower.",
            ),
            if_enum_group(2, ShapeMode.DYNAMIC)(
                NumberInput(
                    "Min Height",
                    default=64,
                    min=16,
                    max=4096,
                    unit="px",
                ).with_docs("Minimum input height for dynamic shapes."),
                NumberInput(
                    "Min Width",
                    default=64,
                    min=16,
                    max=4096,
                    unit="px",
                ).with_docs("Minimum input width for dynamic shapes."),
                NumberInput(
                    "Optimal Height",
                    default=512,
                    min=16,
                    max=4096,
                    unit="px",
                ).with_docs("Optimal input height (used for optimization)."),
                NumberInput(
                    "Optimal Width",
                    default=512,
                    min=16,
                    max=4096,
                    unit="px",
                ).with_docs("Optimal input width (used for optimization)."),
                NumberInput(
                    "Max Height",
                    default=2048,
                    min=16,
                    max=8192,
                    unit="px",
                ).with_docs("Maximum input height for dynamic shapes."),
                NumberInput(
                    "Max Width",
                    default=2048,
                    min=16,
                    max=8192,
                    unit="px",
                ).with_docs("Maximum input width for dynamic shapes."),
            ),
            NumberInput(
                "Workspace (GB)",
                default=4.0,
                min=1.0,
                max=32.0,
                precision=1,
                step=0.5,
            ).with_docs(
                "Maximum GPU memory for building. Larger values may allow better optimizations."
            ),
        ],
        outputs=[
            TensorRTEngineOutput(kind="tagged"),
            TextOutput("Build Info"),
        ],
        node_context=True,
    )
    def build_engine_from_onnx_node(
        context: NodeContext,
        onnx_model: OnnxModel,
        precision: Precision,
        shape_mode: ShapeMode,
        min_height: int,
        min_width: int,
        opt_height: int,
        opt_width: int,
        max_height: int,
        max_width: int,
        workspace: float,
    ) -> tuple[TensorRTEngine, str]:
        settings = get_settings(context)
        gpu_index = settings.gpu_index

        # Determine timing cache path
        timing_cache_path = None
        if settings.timing_cache_path:
            import hashlib

            # Create a cache key based on the model
            model_hash = hashlib.md5(onnx_model.bytes[:1024]).hexdigest()[:8]
            timing_cache_path = f"{settings.timing_cache_path}/timing_{model_hash}.cache"

        use_dynamic = shape_mode == ShapeMode.DYNAMIC

        # For fixed mode, use reasonable defaults
        if not use_dynamic:
            min_height = min_width = 64
            opt_height = opt_width = 256
            max_height = max_width = 256

        config = BuildConfig(
            precision=precision.value,
            workspace_size_gb=workspace,
            min_shape=(min_height, min_width),
            opt_shape=(opt_height, opt_width),
            max_shape=(max_height, max_width),
            use_dynamic_shapes=use_dynamic,
        )

        logger.info(
            "Building TensorRT engine: precision=%s, dynamic=%s, workspace=%.1fGB",
            precision.value,
            use_dynamic,
            workspace,
        )

        engine = build_engine_from_onnx(
            onnx_model.bytes,
            config,
            gpu_index=gpu_index,
            timing_cache_path=timing_cache_path,
        )

        build_info = (
            f"Built {precision.value.upper()} engine for {engine.info.gpu_architecture}"
        )
        if use_dynamic:
            build_info += f" (dynamic: {min_height}x{min_width} to {max_height}x{max_width})"

        return engine, build_info
