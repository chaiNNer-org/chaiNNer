"""TensorRT inference execution utilities."""

from __future__ import annotations

import types

import numpy as np
import tensorrt as trt
from cuda.bindings import runtime as cudart

from .memory import CudaMemoryManager
from .model import TensorRTEngine


class TensorRTSession:
    """
    A session for running TensorRT inference.

    Manages the execution context and memory buffers.
    """

    def __init__(
        self,
        engine: TensorRTEngine,
        gpu_index: int = 0,
    ):
        self.engine = engine
        self.gpu_index = gpu_index
        self._trt_engine = None
        self._runtime = None
        self._context = None
        self._memory_manager: CudaMemoryManager | None = None
        self._stream = None
        self._is_loaded = False

    def load(self) -> None:
        """Load the engine and create execution context."""
        if self._is_loaded:
            return

        cudart.cudaSetDevice(self.gpu_index)

        trt_logger = trt.Logger(trt.Logger.WARNING)
        self._runtime = trt.Runtime(trt_logger)
        self._trt_engine = self._runtime.deserialize_cuda_engine(self.engine.bytes)

        if self._trt_engine is None:
            raise RuntimeError("Failed to deserialize TensorRT engine")

        self._context = self._trt_engine.create_execution_context()
        if self._context is None:
            raise RuntimeError("Failed to create execution context")

        self._memory_manager = CudaMemoryManager(self.gpu_index)
        self._stream = self._memory_manager.create_stream()
        self._is_loaded = True

    def unload(self) -> None:
        """Unload the engine and free resources."""
        if not self._is_loaded:
            return

        if self._memory_manager:
            self._memory_manager.cleanup()
            self._memory_manager = None

        self._context = None
        self._trt_engine = None
        self._runtime = None
        self._stream = None
        self._is_loaded = False

    def __enter__(self):
        self.load()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: types.TracebackType | None,
    ) -> bool:
        self.unload()
        return False

    @property
    def is_loaded(self) -> bool:
        return self._is_loaded

    def _get_binding_info(self) -> tuple[str, str, tuple, tuple]:
        """Get input and output binding information."""
        input_name = self._trt_engine.get_tensor_name(0)
        output_name = self._trt_engine.get_tensor_name(1)

        input_shape = self._trt_engine.get_tensor_shape(input_name)
        output_shape = self._trt_engine.get_tensor_shape(output_name)

        return input_name, output_name, tuple(input_shape), tuple(output_shape)

    def infer(self, input_array: np.ndarray) -> np.ndarray:
        """
        Run inference on an input array.

        Args:
            input_array: Input image in NCHW format (batch, channels, height, width)

        Returns:
            Output array in NCHW format
        """
        if not self._is_loaded:
            raise RuntimeError("Session not loaded. Call load() first.")

        input_name, output_name, _, _ = self._get_binding_info()

        # Get actual input shape
        batch, channels, height, width = input_array.shape

        # Set input shape for dynamic inputs
        if self.engine.has_dynamic_shapes:
            self._context.set_input_shape(input_name, (batch, channels, height, width))

        # Get output shape (may depend on input shape for dynamic models)
        output_shape = self._context.get_tensor_shape(output_name)

        # Determine precision
        is_fp16 = self.engine.precision == "fp16"
        dtype = np.float16 if is_fp16 else np.float32

        # Ensure input is contiguous and correct dtype
        input_array = np.ascontiguousarray(input_array.astype(dtype))

        # Allocate output array
        output_array = np.zeros(output_shape, dtype=dtype)

        # Allocate device memory
        assert self._memory_manager is not None
        input_buffer = self._memory_manager.allocate_like(input_array)
        output_buffer = self._memory_manager.allocate_like(output_array)

        try:
            # Copy input to device
            self._memory_manager.copy_to_device(input_array, input_buffer)

            # Set tensor addresses
            self._context.set_tensor_address(input_name, input_buffer.device_ptr)
            self._context.set_tensor_address(output_name, output_buffer.device_ptr)

            # Execute inference
            success = self._context.execute_async_v3(self._stream)
            if not success:
                raise RuntimeError("TensorRT inference execution failed")

            # Synchronize stream
            self._memory_manager.synchronize_stream()

            # Copy output to host
            self._memory_manager.copy_to_host(output_buffer, output_array)

        finally:
            # Free temporary buffers
            input_buffer.free()
            output_buffer.free()
            # Remove from tracked buffers
            self._memory_manager.remove_buffer(input_buffer)
            self._memory_manager.remove_buffer(output_buffer)

        return output_array.astype(np.float32)


# Session cache to avoid repeatedly loading engines
_session_cache: dict[int, TensorRTSession] = {}


def get_tensorrt_session(
    engine: TensorRTEngine,
    gpu_index: int = 0,
) -> TensorRTSession:
    """
    Get a TensorRT session, using caching to avoid reloading.

    The session is cached based on the engine bytes identity.
    """
    cache_key = id(engine.bytes)

    if cache_key not in _session_cache:
        session = TensorRTSession(engine, gpu_index)
        session.load()
        _session_cache[cache_key] = session

    return _session_cache[cache_key]


def clear_session_cache() -> None:
    """Clear the session cache and unload all engines."""
    for session in _session_cache.values():
        session.unload()
    _session_cache.clear()


def run_inference(
    img: np.ndarray,
    engine: TensorRTEngine,
    gpu_index: int = 0,
) -> np.ndarray:
    """
    Run TensorRT inference on an image.

    Args:
        img: Input image in HWC format (height, width, channels), float32, 0-1 range
        engine: TensorRT engine
        gpu_index: GPU device index

    Returns:
        Output image in HWC format
    """
    session = get_tensorrt_session(engine, gpu_index)

    # Convert HWC to NCHW
    if img.ndim == 2:
        # Grayscale
        img = img[np.newaxis, np.newaxis, :, :]
    elif img.ndim == 3:
        # HWC -> NCHW
        img = img.transpose(2, 0, 1)[np.newaxis, :, :, :]
    else:
        raise ValueError(f"Unexpected image dimensions: {img.ndim}")

    # Run inference
    output = session.infer(img)

    # Convert NCHW back to HWC
    if output.ndim == 4:
        output = output.squeeze(0).transpose(1, 2, 0)
    elif output.ndim == 3:
        output = output.transpose(1, 2, 0)

    return output
