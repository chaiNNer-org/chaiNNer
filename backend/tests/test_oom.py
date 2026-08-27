"""
Tests for OOM (Out of Memory) detection and recovery functionality.
"""

from __future__ import annotations

import numpy as np

from nodes.impl.oom import (
    OomRecoveryExhaustedError,
    is_cuda_oom,
    is_ncnn_oom,
    is_non_oom_error,
    is_onnx_oom,
    is_pytorch_oom,
    is_tensorrt_oom,
)
from nodes.impl.pytorch.pix_transform.auto_split import _PixTiler
from nodes.impl.upscale.auto_split import Split, _exact_split, _max_split, _SplitEx


def test_pix_transform_tiler_allows_oom_recovery():
    assert _PixTiler().allow_smaller_tile_size() is True


class TestOOMClassifiers:
    """Test OOM classifier functions."""

    def test_is_pytorch_oom_matches_cuda_patterns(self):
        """Test that PyTorch OOM detection matches known CUDA OOM patterns."""
        assert is_pytorch_oom(RuntimeError("cuda out of memory")) is True
        assert is_pytorch_oom(RuntimeError("out of memory cuda")) is True
        assert is_pytorch_oom(RuntimeError("allocating 1024 bytes cuda")) is True
        assert is_pytorch_oom(RuntimeError("cuda error out of memory")) is True
        assert is_pytorch_oom(RuntimeError("some cuda error out of memory")) is True

        # Test non-OOM errors
        assert is_pytorch_oom(ValueError("invalid input")) is False
        assert is_pytorch_oom(RuntimeError("some other error")) is False
        assert is_pytorch_oom(RuntimeError("out of memory")) is False  # Missing cuda

    def test_is_onnx_oom_matches_patterns(self):
        """Test that ONNX OOM detection matches known patterns."""
        assert (
            is_onnx_oom(Exception("ONNXRuntimeError: allocate memory failed")) is True
        )
        assert is_onnx_oom(Exception("onnxruntime: out of memory")) is True
        assert is_onnx_oom(Exception("cuda malloc failed in onnxruntime")) is True
        assert is_onnx_oom(Exception("resource exhausted in onnxruntime")) is True

        # Test non-ONNX errors
        assert is_onnx_oom(ValueError("invalid input")) is False
        assert is_onnx_oom(RuntimeError("CUDA out of memory")) is False  # Not ONNX

        # Test ONNX but not OOM
        assert is_onnx_oom(Exception("ONNXRuntimeError: shape mismatch")) is False

    def test_is_ncnn_oom_matches_patterns(self):
        """Test that NCNN OOM detection matches known patterns."""
        assert is_ncnn_oom(Exception("failed to allocate memory")) is True
        assert is_ncnn_oom(Exception("allocation failed")) is True
        assert is_ncnn_oom(Exception("out of memory")) is True
        assert is_ncnn_oom(Exception("vkqueuesubmit failed")) is True

        # Test the specific case that should return False
        assert is_ncnn_oom(Exception("vkQueueSubmit")) is False

        # Test non-OOM errors
        assert is_ncnn_oom(ValueError("invalid input")) is False

    def test_is_tensorrt_oom_matches_patterns(self):
        """Test that TensorRT OOM detection matches known patterns."""
        assert is_tensorrt_oom(Exception("out of memory")) is True
        assert is_tensorrt_oom(Exception("cuda memory allocate failed")) is True
        assert is_tensorrt_oom(Exception("failed to allocate device memory")) is True
        assert is_tensorrt_oom(Exception("memory allocation failed")) is True
        assert is_tensorrt_oom(Exception("resource exhausted gpu")) is True

        # Test non-OOM errors
        assert is_tensorrt_oom(ValueError("invalid input")) is False

    def test_is_cuda_oom_combines_all_detectors(self):
        """Test that CUDA OOM detection combines all specific detectors."""
        # Should return True if any specific detector returns True
        assert is_cuda_oom(RuntimeError("cuda out of memory")) is True  # PyTorch
        assert is_cuda_oom(Exception("onnxruntime: out of memory")) is True  # ONNX
        assert is_cuda_oom(Exception("failed allocate")) is True  # NCNN
        assert is_cuda_oom(Exception("out of memory")) is True  # TensorRT

        # Should return False if all detectors return False
        assert is_cuda_oom(ValueError("invalid input")) is False

    def test_is_non_oom_error_matches_patterns(self):
        """Test that non-OOM error detection matches known patterns."""
        for indicator in [
            "assertion failed",
            "invalid argument",
            "invalid value",
            "unsupported operation",
            "not implemented",
            "file not found",
            "permission denied",
            "invalid model",
            "invalid input",
            "shape mismatch",
            "dimension mismatch",
            "type mismatch",
        ]:
            assert is_non_oom_error(Exception(indicator)) is True

        # Test OOM errors should return False
        assert is_non_oom_error(RuntimeError("cuda out of memory")) is False
        assert is_non_oom_error(Exception("out of memory")) is False

        # Test other errors should return False
        assert is_non_oom_error(ValueError("some other error")) is False


class TestOomRecoveryExhaustedError:
    """Test OomRecoveryExhaustedError exception."""

    def test_oom_recovery_exhausted_error_creation(self):
        """Test creating OomRecoveryExhaustedError with proper attributes."""
        original_error = RuntimeError("cuda out of memory")
        error = OomRecoveryExhaustedError(
            original_error=original_error, attempts=3, last_tile_size=(256, 256)
        )

        assert error.original_error is original_error
        assert error.attempts == 3
        assert error.last_tile_size == (256, 256)
        assert "VRAM out-of-memory recovery exhausted after 3 attempts" in str(error)
        assert "(last tile size: 256x256)" in str(error)
        assert "Original error: cuda out of memory" in str(error)


class TestExactSplitOOMRecovery:
    """Test OOM behavior in the exact split (manual) path — no automatic retry."""

    def test_oom_split_immediate_exhaustion(self):
        """Returning Split triggers OomRecoveryExhaustedError without retrying."""
        img = np.zeros((64, 64, 3), dtype=np.float32)
        cleanup_calls = []

        def mock_upscale(image, region):
            return Split()

        def mock_oom_cleanup():
            cleanup_calls.append(True)

        try:
            _exact_split(
                img=img,
                upscale=mock_upscale,
                starting_tile_size=(64, 64),
                split_tile_size=lambda size: (size[0] // 2, size[1] // 2),
                overlap=0,
                progress=None,
                oom_cleanup=mock_oom_cleanup,
            )
        except OomRecoveryExhaustedError as e:
            assert e.attempts == 0
            assert e.last_tile_size == (64, 64)
            assert "out of memory" in str(e.original_error).lower()
            assert len(cleanup_calls) == 1
        else:
            raise AssertionError("Expected OomRecoveryExhaustedError")

    def test_oom_exception_immediate_exhaustion(self):
        """An OOM exception triggers OomRecoveryExhaustedError without retrying."""
        img = np.zeros((64, 64, 3), dtype=np.float32)
        cleanup_calls = []
        original_error = RuntimeError("cuda out of memory")

        def mock_upscale(image, region):
            raise original_error

        def mock_oom_cleanup():
            cleanup_calls.append(True)

        try:
            _exact_split(
                img=img,
                upscale=mock_upscale,
                starting_tile_size=(64, 64),
                split_tile_size=lambda size: (size[0] // 2, size[1] // 2),
                overlap=0,
                progress=None,
                oom_cleanup=mock_oom_cleanup,
            )
        except OomRecoveryExhaustedError as e:
            assert e.attempts == 0
            assert e.last_tile_size == (64, 64)
            assert e.original_error is original_error
            assert len(cleanup_calls) == 1
        else:
            raise AssertionError("Expected OomRecoveryExhaustedError")

    def test_non_oom_error_propagates(self):
        """Propagate non-OOM errors immediately without calling OOM cleanup."""
        img = np.zeros((64, 64, 3), dtype=np.float32)
        cleanup_calls = []

        def mock_upscale(image, region):
            raise ValueError("invalid argument")

        def mock_oom_cleanup():
            cleanup_calls.append(True)

        try:
            _exact_split(
                img=img,
                upscale=mock_upscale,
                starting_tile_size=(64, 64),
                split_tile_size=lambda size: (size[0] // 2, size[1] // 2),
                overlap=0,
                progress=None,
                oom_cleanup=mock_oom_cleanup,
            )
        except ValueError as e:
            assert str(e) == "invalid argument"
        else:
            raise AssertionError("Expected ValueError")

        assert len(cleanup_calls) == 0

    def test_unrelated_exception_propagates(self):
        """An exception that is neither a non-OOM indicator nor a recognized
        GPU OOM must propagate unchanged, without OOM cleanup."""
        img = np.zeros((64, 64, 3), dtype=np.float32)
        cleanup_calls = []
        unrelated = RuntimeError("some other error")

        def mock_upscale(image, region):
            raise unrelated

        def mock_oom_cleanup():
            cleanup_calls.append(True)

        try:
            _exact_split(
                img=img,
                upscale=mock_upscale,
                starting_tile_size=(64, 64),
                split_tile_size=lambda size: (size[0] // 2, size[1] // 2),
                overlap=0,
                progress=None,
                oom_cleanup=mock_oom_cleanup,
            )
        except RuntimeError as e:
            assert e is unrelated
        else:
            raise AssertionError("Expected RuntimeError")

        assert len(cleanup_calls) == 0

    def test_recognized_cuda_oom_wraps(self):
        """A recognized GPU OOM exception is wrapped as OomRecoveryExhaustedError."""
        img = np.zeros((64, 64, 3), dtype=np.float32)
        cleanup_calls = []
        original_error = RuntimeError("cuda out of memory")

        def mock_upscale(image, region):
            raise original_error

        def mock_oom_cleanup():
            cleanup_calls.append(True)

        try:
            _exact_split(
                img=img,
                upscale=mock_upscale,
                starting_tile_size=(64, 64),
                split_tile_size=lambda size: (size[0] // 2, size[1] // 2),
                overlap=0,
                progress=None,
                oom_cleanup=mock_oom_cleanup,
            )
        except OomRecoveryExhaustedError as e:
            assert e.original_error is original_error
            assert e.attempts == 0
            assert e.last_tile_size == (64, 64)
            assert len(cleanup_calls) == 1
        else:
            raise AssertionError("Expected OomRecoveryExhaustedError")


class TestMaxSplitOOMRecovery:
    """Test OOM recovery in the max split (auto tile) path."""

    def test_oom_exception_retry_then_success(self):
        """Retry with smaller tiles after an OOM exception, then succeed."""
        img = np.zeros((256, 256, 3), dtype=np.float32)
        call_count = 0
        cleanup_calls = []

        def mock_upscale(image, region):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise _SplitEx()
            h, w, _ = image.shape
            return np.zeros((h * 2, w * 2, 3), dtype=np.float32)

        def split_tile_size(size):
            return (size[0] // 2, size[1] // 2)

        def mock_oom_cleanup():
            cleanup_calls.append(True)

        result = _max_split(
            img=img,
            upscale=mock_upscale,
            starting_tile_size=(128, 128),
            split_tile_size=split_tile_size,
            overlap=0,
            progress=None,
            oom_cleanup=mock_oom_cleanup,
        )

        assert call_count > 1
        assert len(cleanup_calls) == 1
        assert result.shape == (512, 512, 3)

    def test_partial_output_discarded_on_oom(self):
        """Discard partial rows when a tile OOMs mid-process and retry."""
        img = np.zeros((128, 128, 3), dtype=np.float32)
        call_count = 0
        cleanup_calls = []

        def mock_upscale(image, region):
            nonlocal call_count
            call_count += 1
            if call_count == 4:
                raise _SplitEx()
            h, w, _ = image.shape
            return np.zeros((h * 2, w * 2, 3), dtype=np.float32)

        def split_tile_size(size):
            return (size[0] // 2, size[1] // 2)

        def mock_oom_cleanup():
            cleanup_calls.append(True)

        result = _max_split(
            img=img,
            upscale=mock_upscale,
            starting_tile_size=(64, 64),
            split_tile_size=split_tile_size,
            overlap=0,
            progress=None,
            oom_cleanup=mock_oom_cleanup,
        )

        assert len(cleanup_calls) == 1
        assert result.shape == (256, 256, 3)

    def test_split_request_reduces_tile_size(self):
        """A cooperative Split request reduces the tile size and retries."""
        img = np.zeros((256, 256, 3), dtype=np.float32)
        call_count = 0
        cleanup_calls = []

        def mock_upscale(image, region):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return Split()
            h, w, _ = image.shape
            return np.zeros((h * 2, w * 2, 3), dtype=np.float32)

        def split_tile_size(size):
            return (size[0] // 2, size[1] // 2)

        def mock_oom_cleanup():
            cleanup_calls.append(True)

        result = _max_split(
            img=img,
            upscale=mock_upscale,
            starting_tile_size=(128, 128),
            split_tile_size=split_tile_size,
            overlap=0,
            progress=None,
            oom_cleanup=mock_oom_cleanup,
        )

        assert len(cleanup_calls) == 1
        assert result.shape == (512, 512, 3)

    def test_oom_exhaustion_raises(self):
        """Raise OomRecoveryExhaustedError when tiles never stop splitting."""
        img = np.zeros((128, 128, 3), dtype=np.float32)
        cleanup_calls = []

        def mock_upscale(image, region):
            return Split()

        def split_tile_size(size):
            if size[0] <= 16:
                raise ValueError("Cannot split further")
            return (size[0] // 2, size[1] // 2)

        def mock_oom_cleanup():
            cleanup_calls.append(True)

        try:
            _max_split(
                img=img,
                upscale=mock_upscale,
                starting_tile_size=(64, 64),
                split_tile_size=split_tile_size,
                overlap=0,
                progress=None,
                oom_cleanup=mock_oom_cleanup,
            )
        except OomRecoveryExhaustedError as e:
            assert e.attempts >= 1
            assert e.original_error is not None
            assert len(cleanup_calls) == e.attempts
        else:
            raise AssertionError("Expected OomRecoveryExhaustedError")
