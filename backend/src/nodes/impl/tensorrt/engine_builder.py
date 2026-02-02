"""TensorRT engine building utilities."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from logger import logger

from .memory import get_cuda_compute_capability, get_cuda_device_name
from .model import TensorRTEngine, TensorRTEngineInfo


@dataclass
class BuildConfig:
    """Configuration for TensorRT engine building."""

    precision: Literal["fp32", "fp16"]
    workspace_size_gb: float
    min_shape: tuple[int, int]  # (height, width)
    opt_shape: tuple[int, int]  # (height, width)
    max_shape: tuple[int, int]  # (height, width)
    use_dynamic_shapes: bool


class TrtLogger:
    """Custom TensorRT logger that integrates with chaiNNer's logging."""

    def __init__(self):
        import tensorrt as trt

        self.severity_map = {
            trt.ILogger.Severity.INTERNAL_ERROR: logger.error,
            trt.ILogger.Severity.ERROR: logger.error,
            trt.ILogger.Severity.WARNING: logger.warning,
            trt.ILogger.Severity.INFO: logger.info,
            trt.ILogger.Severity.VERBOSE: logger.debug,
        }

    def log(self, severity: Any, msg: str) -> None:
        log_fn = self.severity_map.get(severity, logger.debug)
        log_fn("[TensorRT] %s", msg)


def get_trt_logger():
    """Get a TensorRT logger instance."""
    import tensorrt as trt

    # Use a simple logger class
    class SimpleLogger(trt.ILogger):
        def log(self, severity: Any, msg: str) -> None:
            if severity <= trt.ILogger.Severity.WARNING:
                logger.warning("[TensorRT] %s", msg)
            elif severity <= trt.ILogger.Severity.INFO:
                logger.info("[TensorRT] %s", msg)
            else:
                logger.debug("[TensorRT] %s", msg)

    return SimpleLogger()


def parse_onnx_model(
    onnx_bytes: bytes,
    network: Any,
    parser: Any,
) -> None:
    """Parse an ONNX model into a TensorRT network."""
    success = parser.parse(onnx_bytes)
    if not success:
        error_msgs = []
        for i in range(parser.num_errors):
            error = parser.get_error(i)
            error_msgs.append(f"  {error.desc()}")
        errors_str = "\n".join(error_msgs)
        raise RuntimeError(f"Failed to parse ONNX model:\n{errors_str}")


def configure_builder_config(
    builder: Any,
    config: BuildConfig,
) -> Any:
    """Configure the TensorRT builder with the given settings."""
    import tensorrt as trt

    builder_config = builder.create_builder_config()

    # Set workspace size
    workspace_bytes = int(config.workspace_size_gb * (1024**3))
    builder_config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, workspace_bytes)

    # Set precision
    if config.precision == "fp16":
        if builder.platform_has_fast_fp16:
            builder_config.set_flag(trt.BuilderFlag.FP16)
            logger.info("FP16 mode enabled")
        else:
            logger.warning("FP16 not supported on this platform, falling back to FP32")

    return builder_config


def build_engine_from_onnx(
    onnx_bytes: bytes,
    config: BuildConfig,
    gpu_index: int = 0,
    timing_cache_path: str | None = None,
) -> TensorRTEngine:
    """
    Build a TensorRT engine from an ONNX model.

    Args:
        onnx_bytes: The ONNX model as bytes
        config: Build configuration
        gpu_index: GPU device index to use
        timing_cache_path: Optional path to timing cache for faster rebuilds

    Returns:
        A TensorRTEngine instance
    """
    import tensorrt as trt
    from cuda.bindings import runtime as cudart

    # Set the CUDA device
    cudart.cudaSetDevice(gpu_index)

    trt_logger = trt.Logger(trt.Logger.WARNING)

    # Create builder and network
    builder = trt.Builder(trt_logger)
    network_flags = 1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH)
    network = builder.create_network(network_flags)
    parser = trt.OnnxParser(network, trt_logger)

    # Parse ONNX model
    logger.info("Parsing ONNX model...")
    parse_onnx_model(onnx_bytes, network, parser)

    # Get input/output info
    input_tensor = network.get_input(0)
    output_tensor = network.get_output(0)

    input_shape = input_tensor.shape
    output_shape = output_tensor.shape

    # Detect channels (assuming NCHW format)
    input_channels = input_shape[1] if len(input_shape) >= 4 else 3
    output_channels = output_shape[1] if len(output_shape) >= 4 else 3

    # Calculate scale from input/output dimensions
    scale = None
    if len(input_shape) >= 4 and len(output_shape) >= 4:
        in_h, in_w = input_shape[2], input_shape[3]
        out_h, out_w = output_shape[2], output_shape[3]

        if in_h > 0 and in_w > 0 and out_h > 0 and out_w > 0:
            scale_h = out_h // in_h if out_h % in_h == 0 else None
            scale_w = out_w // in_w if out_w % in_w == 0 else None
            if scale_h == scale_w and scale_h is not None:
                scale = scale_h

    # Configure builder
    builder_config = builder.create_builder_config()
    workspace_bytes = int(config.workspace_size_gb * (1024**3))
    builder_config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, workspace_bytes)

    # Set precision
    if config.precision == "fp16":
        if builder.platform_has_fast_fp16:
            builder_config.set_flag(trt.BuilderFlag.FP16)
            logger.info("FP16 mode enabled")
        else:
            logger.warning("FP16 not supported on this platform, using FP32")

    # Configure dynamic shapes if needed
    has_dynamic = any(d == -1 for d in input_shape)
    if has_dynamic or config.use_dynamic_shapes:
        logger.info("Configuring dynamic shapes...")
        profile = builder.create_optimization_profile()

        min_h, min_w = config.min_shape
        opt_h, opt_w = config.opt_shape
        max_h, max_w = config.max_shape

        # Set the optimization profile for the input tensor
        min_dims = (1, input_channels, min_h, min_w)
        opt_dims = (1, input_channels, opt_h, opt_w)
        max_dims = (1, input_channels, max_h, max_w)

        profile.set_shape(input_tensor.name, min_dims, opt_dims, max_dims)
        builder_config.add_optimization_profile(profile)

    # Load timing cache if available
    if timing_cache_path:
        try:
            with open(timing_cache_path, "rb") as f:
                cache_data = f.read()
                timing_cache = builder_config.create_timing_cache(cache_data)
                builder_config.set_timing_cache(timing_cache, ignore_mismatch=False)
                logger.info("Loaded timing cache from %s", timing_cache_path)
        except FileNotFoundError:
            logger.debug("No timing cache found at %s", timing_cache_path)
        except Exception as e:
            logger.warning("Failed to load timing cache: %s", e)

    # Build the engine
    logger.info("Building TensorRT engine (this may take a while)...")
    serialized_engine = builder.build_serialized_network(network, builder_config)

    if serialized_engine is None:
        raise RuntimeError("Failed to build TensorRT engine")

    # Save timing cache
    if timing_cache_path:
        try:
            timing_cache = builder_config.get_timing_cache()
            if timing_cache:
                cache_data = timing_cache.serialize()
                with open(timing_cache_path, "wb") as f:
                    f.write(cache_data)
                logger.info("Saved timing cache to %s", timing_cache_path)
        except Exception as e:
            logger.warning("Failed to save timing cache: %s", e)

    # Get GPU info
    major, minor = get_cuda_compute_capability(gpu_index)
    gpu_arch = f"sm_{major}{minor}"
    gpu_name = get_cuda_device_name(gpu_index)
    logger.info("Built engine for %s (%s)", gpu_name, gpu_arch)

    # Create engine info
    info = TensorRTEngineInfo(
        precision=config.precision,
        input_channels=input_channels,
        output_channels=output_channels,
        scale=scale,
        gpu_architecture=gpu_arch,
        tensorrt_version=trt.__version__,
        has_dynamic_shapes=has_dynamic or config.use_dynamic_shapes,
        min_shape=(config.min_shape[1], config.min_shape[0])
        if config.use_dynamic_shapes
        else None,
        opt_shape=(config.opt_shape[1], config.opt_shape[0])
        if config.use_dynamic_shapes
        else None,
        max_shape=(config.max_shape[1], config.max_shape[0])
        if config.use_dynamic_shapes
        else None,
    )

    return TensorRTEngine(bytes(serialized_engine), info)


def load_engine_from_bytes(
    engine_bytes: bytes,
    gpu_index: int = 0,
) -> tuple[object, object]:
    """
    Load a TensorRT engine from bytes.

    Returns the runtime and deserialized engine.
    """
    import tensorrt as trt
    from cuda.bindings import runtime as cudart

    cudart.cudaSetDevice(gpu_index)

    trt_logger = trt.Logger(trt.Logger.WARNING)
    runtime = trt.Runtime(trt_logger)

    engine = runtime.deserialize_cuda_engine(engine_bytes)
    if engine is None:
        raise RuntimeError("Failed to deserialize TensorRT engine")

    return runtime, engine
