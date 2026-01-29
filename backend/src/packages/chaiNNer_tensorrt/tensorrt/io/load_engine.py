from __future__ import annotations

import os
from pathlib import Path

from api import NodeContext
from logger import logger
from nodes.impl.tensorrt.memory import get_cuda_compute_capability
from nodes.impl.tensorrt.model import TensorRTEngine, TensorRTEngineInfo
from nodes.properties.inputs import TensorRTFileInput
from nodes.properties.outputs import DirectoryOutput, FileNameOutput, TensorRTEngineOutput
from nodes.utils.utils import split_file_path

from ...settings import get_settings
from .. import io_group

if io_group is not None:

    @io_group.register(
        schema_id="chainner:tensorrt:load_engine",
        name="Load Engine",
        description=(
            "Load a TensorRT engine file (.engine, .trt, .plan). "
            "TensorRT engines are built for a specific GPU architecture and may not work "
            "on different GPUs. The node will warn you if there's a potential compatibility issue."
        ),
        icon="Nvidia",
        inputs=[TensorRTFileInput(primary_input=True)],
        outputs=[
            TensorRTEngineOutput(kind="tagged").suggest(),
            DirectoryOutput("Directory", of_input=0).with_id(2),
            FileNameOutput("Name", of_input=0).with_id(1),
        ],
        side_effects=True,
        node_context=True,
    )
    def load_engine_node(
        context: NodeContext, path: Path
    ) -> tuple[TensorRTEngine, Path, str]:
        import tensorrt as trt

        assert os.path.exists(path), f"Engine file at location {path} does not exist"
        assert os.path.isfile(path), f"Path {path} is not a file"

        logger.debug("Reading TensorRT engine from path: %s", path)

        settings = get_settings(context)
        gpu_index = settings.gpu_index

        # Check GPU compatibility
        current_major, current_minor = get_cuda_compute_capability(gpu_index)
        current_arch = f"sm_{current_major}{current_minor}"

        # Load engine bytes
        with open(path, "rb") as f:
            engine_bytes = f.read()

        # Deserialize to get engine info
        trt_logger = trt.Logger(trt.Logger.WARNING)
        runtime = trt.Runtime(trt_logger)
        engine = runtime.deserialize_cuda_engine(engine_bytes)

        if engine is None:
            raise RuntimeError(
                f"Failed to deserialize TensorRT engine from {path}. "
                "This may happen if the engine was built with an incompatible TensorRT version "
                "or for a different GPU architecture."
            )

        # Extract engine information
        input_name = engine.get_tensor_name(0)
        output_name = engine.get_tensor_name(1)

        input_shape = engine.get_tensor_shape(input_name)
        output_shape = engine.get_tensor_shape(output_name)

        # Detect channels
        input_channels = input_shape[1] if len(input_shape) >= 4 else 3
        output_channels = output_shape[1] if len(output_shape) >= 4 else 3

        # Calculate scale
        scale = None
        if len(input_shape) >= 4 and len(output_shape) >= 4:
            in_h, in_w = input_shape[2], input_shape[3]
            out_h, out_w = output_shape[2], output_shape[3]
            if in_h > 0 and in_w > 0 and out_h > 0 and out_w > 0:
                scale_h = out_h // in_h if out_h % in_h == 0 else None
                scale_w = out_w // in_w if out_w % in_w == 0 else None
                if scale_h == scale_w and scale_h is not None:
                    scale = scale_h

        # Check for dynamic shapes
        has_dynamic = any(d == -1 for d in input_shape)

        # Detect precision from the engine (this is a heuristic)
        # TensorRT doesn't provide a direct way to query the precision
        precision = "fp32"  # Default assumption

        # Create info
        info = TensorRTEngineInfo(
            precision=precision,
            input_channels=input_channels,
            output_channels=output_channels,
            scale=scale,
            gpu_architecture=current_arch,
            tensorrt_version=trt.__version__,
            has_dynamic_shapes=has_dynamic,
            min_shape=None,
            opt_shape=None,
            max_shape=None,
        )

        dirname, basename, _ = split_file_path(path)
        return TensorRTEngine(engine_bytes, info), dirname, basename
