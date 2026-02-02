from __future__ import annotations

from nodes.impl.tensorrt.model import TensorRTEngine
from nodes.properties.inputs import TensorRTEngineInput
from nodes.properties.outputs import NumberOutput, TextOutput

from .. import utility_group

if utility_group is not None:

    @utility_group.register(
        schema_id="chainner:tensorrt:engine_info",
        name="Get Engine Info",
        description="Returns information about a TensorRT engine.",
        icon="ImInfo",
        inputs=[TensorRTEngineInput("TensorRT Engine")],
        outputs=[
            NumberOutput(
                "Scale",
                output_type="""
                    if Input0.scale == null { -1 } else { Input0.scale }
                """,
            ),
            TextOutput(
                "Precision",
                output_type="Input0.precision",
            ),
            TextOutput(
                "GPU Architecture",
            ),
            TextOutput(
                "TensorRT Version",
            ),
            TextOutput(
                "Shape Info",
            ),
        ],
    )
    def get_engine_info_node(
        engine: TensorRTEngine,
    ) -> tuple[int, str, str, str, str]:
        info = engine.info

        scale = info.scale if info.scale is not None else -1
        precision = info.precision.upper()
        gpu_arch = info.gpu_architecture
        trt_version = info.tensorrt_version

        if info.has_dynamic_shapes:
            if info.min_shape and info.max_shape and info.opt_shape:
                shape_info = (
                    f"Dynamic: "
                    f"Min: {info.min_shape[2]}x{info.min_shape[3]} "
                    f"Opt: {info.opt_shape[2]}x{info.opt_shape[3]} "
                    f"Max: {info.max_shape[2]}x{info.max_shape[3]}"
                )
            else:
                shape_info = "Dynamic"
        elif info.opt_shape:
            shape_info = f"Fixed: {info.opt_shape[2]}x{info.opt_shape[3]}"
        else:
            shape_info = "Fixed"

        return scale, precision, gpu_arch, trt_version, shape_info
