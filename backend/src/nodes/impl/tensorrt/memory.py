"""CUDA memory management utilities for TensorRT inference."""

from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from cuda import cudart


@dataclass
class CudaBuffer:
    """Represents a CUDA device memory buffer."""

    device_ptr: int
    size: int
    dtype: np.dtype

    def free(self) -> None:
        """Free the device memory."""
        from cuda import cudart

        if self.device_ptr != 0:
            cudart.cudaFree(self.device_ptr)
            self.device_ptr = 0


class CudaMemoryManager:
    """
    Manages CUDA memory allocation for TensorRT inference.

    Uses RAII pattern with context managers to ensure proper cleanup.
    """

    def __init__(self, device_id: int = 0):
        self.device_id = device_id
        self._buffers: list[CudaBuffer] = []
        self._stream: int | None = None

    def _check_cuda_error(self, result: tuple) -> None:
        """Check CUDA runtime API result for errors."""
        err = result[0]
        if err.value != 0:
            from cuda import cudart

            err_name = cudart.cudaGetErrorName(err)[1]
            err_string = cudart.cudaGetErrorString(err)[1]
            raise RuntimeError(f"CUDA Error {err_name}: {err_string}")

    def allocate(self, size: int, dtype: np.dtype = np.float32) -> CudaBuffer:
        """Allocate device memory."""
        from cuda import cudart

        result = cudart.cudaMalloc(size)
        self._check_cuda_error(result)
        device_ptr = result[1]
        buffer = CudaBuffer(device_ptr, size, dtype)
        self._buffers.append(buffer)
        return buffer

    def allocate_like(self, array: np.ndarray) -> CudaBuffer:
        """Allocate device memory matching the size and dtype of an array."""
        return self.allocate(array.nbytes, array.dtype)

    def copy_to_device(self, host_array: np.ndarray, device_buffer: CudaBuffer) -> None:
        """Copy data from host to device."""
        from cuda import cudart

        host_ptr = host_array.ctypes.data
        self._check_cuda_error(
            cudart.cudaMemcpy(
                device_buffer.device_ptr,
                host_ptr,
                host_array.nbytes,
                cudart.cudaMemcpyKind.cudaMemcpyHostToDevice,
            )
        )

    def copy_to_host(
        self, device_buffer: CudaBuffer, host_array: np.ndarray
    ) -> np.ndarray:
        """Copy data from device to host."""
        from cuda import cudart

        host_ptr = host_array.ctypes.data
        self._check_cuda_error(
            cudart.cudaMemcpy(
                host_ptr,
                device_buffer.device_ptr,
                host_array.nbytes,
                cudart.cudaMemcpyKind.cudaMemcpyDeviceToHost,
            )
        )
        return host_array

    def create_stream(self) -> int:
        """Create a CUDA stream."""
        from cuda import cudart

        result = cudart.cudaStreamCreate()
        self._check_cuda_error(result)
        self._stream = result[1]
        return self._stream

    def synchronize(self) -> None:
        """Synchronize the CUDA device."""
        from cuda import cudart

        self._check_cuda_error(cudart.cudaDeviceSynchronize())

    def synchronize_stream(self) -> None:
        """Synchronize the CUDA stream."""
        from cuda import cudart

        if self._stream is not None:
            self._check_cuda_error(cudart.cudaStreamSynchronize(self._stream))

    def cleanup(self) -> None:
        """Free all allocated resources."""
        from cuda import cudart

        for buffer in self._buffers:
            buffer.free()
        self._buffers.clear()

        if self._stream is not None:
            cudart.cudaStreamDestroy(self._stream)
            self._stream = None


@contextmanager
def cuda_memory_context(device_id: int = 0):
    """
    Context manager for CUDA memory operations.

    Ensures all allocated memory is freed when the context exits.
    """
    manager = CudaMemoryManager(device_id)
    try:
        yield manager
    finally:
        manager.cleanup()


def check_cuda_available() -> bool:
    """Check if CUDA is available."""
    try:
        from cuda import cudart

        result = cudart.cudaGetDeviceCount()
        return result[0].value == 0 and result[1] > 0
    except ImportError:
        return False
    except Exception:
        return False


def get_cuda_device_name(device_id: int = 0) -> str:
    """Get the name of a CUDA device."""
    try:
        from cuda import cudart

        result = cudart.cudaGetDeviceProperties(device_id)
        if result[0].value == 0:
            return result[1].name.decode("utf-8") if isinstance(result[1].name, bytes) else result[1].name
        return "Unknown"
    except Exception:
        return "Unknown"


def get_cuda_compute_capability(device_id: int = 0) -> tuple[int, int]:
    """Get the compute capability of a CUDA device."""
    try:
        from cuda import cudart

        result = cudart.cudaGetDeviceProperties(device_id)
        if result[0].value == 0:
            return result[1].major, result[1].minor
        return (0, 0)
    except Exception:
        return (0, 0)
