from __future__ import annotations

import sys
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pynvml as nv

# Add the backend/src directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


# Mock sanic.log before importing gpu
class MockLogger:
    @staticmethod
    def info(*args: Any, **kwargs: Any) -> None:
        pass

    @staticmethod
    def warn(*args: Any, **kwargs: Any) -> None:
        pass


mock_logger = MockLogger()
sys.modules["sanic"] = MagicMock()
sys.modules["sanic.log"] = MagicMock(logger=mock_logger)

from gpu import NvDevice, NvInfo  # noqa: E402


def test_any_needs_legacy_cuda_with_pascal():
    """Test that Pascal architecture is detected as needing legacy CUDA"""
    # Create mock devices
    mock_device_pascal = MagicMock(spec=NvDevice)
    mock_device_pascal.architecture = nv.NVML_DEVICE_ARCH_PASCAL
    mock_device_pascal.supports_fp16 = False

    nv_info = NvInfo([mock_device_pascal], lambda: None)
    assert nv_info.any_needs_legacy_cuda is True


def test_any_needs_legacy_cuda_with_maxwell():
    """Test that Maxwell architecture is detected as needing legacy CUDA"""
    mock_device_maxwell = MagicMock(spec=NvDevice)
    mock_device_maxwell.architecture = nv.NVML_DEVICE_ARCH_MAXWELL
    mock_device_maxwell.supports_fp16 = False

    nv_info = NvInfo([mock_device_maxwell], lambda: None)
    assert nv_info.any_needs_legacy_cuda is True


def test_any_needs_legacy_cuda_with_kepler():
    """Test that Kepler architecture is detected as needing legacy CUDA"""
    mock_device_kepler = MagicMock(spec=NvDevice)
    mock_device_kepler.architecture = nv.NVML_DEVICE_ARCH_KEPLER
    mock_device_kepler.supports_fp16 = False

    nv_info = NvInfo([mock_device_kepler], lambda: None)
    assert nv_info.any_needs_legacy_cuda is True


def test_any_needs_legacy_cuda_with_volta():
    """Test that Volta architecture does not need legacy CUDA"""
    mock_device_volta = MagicMock(spec=NvDevice)
    mock_device_volta.architecture = nv.NVML_DEVICE_ARCH_VOLTA
    mock_device_volta.supports_fp16 = True

    nv_info = NvInfo([mock_device_volta], lambda: None)
    assert nv_info.any_needs_legacy_cuda is False


def test_any_needs_legacy_cuda_with_turing():
    """Test that Turing architecture does not need legacy CUDA"""
    mock_device_turing = MagicMock(spec=NvDevice)
    mock_device_turing.architecture = nv.NVML_DEVICE_ARCH_TURING
    mock_device_turing.supports_fp16 = True

    nv_info = NvInfo([mock_device_turing], lambda: None)
    assert nv_info.any_needs_legacy_cuda is False


def test_any_needs_legacy_cuda_with_ampere():
    """Test that Ampere architecture does not need legacy CUDA"""
    mock_device_ampere = MagicMock(spec=NvDevice)
    mock_device_ampere.architecture = nv.NVML_DEVICE_ARCH_AMPERE
    mock_device_ampere.supports_fp16 = True

    nv_info = NvInfo([mock_device_ampere], lambda: None)
    assert nv_info.any_needs_legacy_cuda is False


def test_any_needs_legacy_cuda_with_ada():
    """Test that Ada architecture does not need legacy CUDA"""
    mock_device_ada = MagicMock(spec=NvDevice)
    mock_device_ada.architecture = nv.NVML_DEVICE_ARCH_ADA
    mock_device_ada.supports_fp16 = True

    nv_info = NvInfo([mock_device_ada], lambda: None)
    assert nv_info.any_needs_legacy_cuda is False


def test_any_needs_legacy_cuda_with_hopper():
    """Test that Hopper architecture does not need legacy CUDA"""
    mock_device_hopper = MagicMock(spec=NvDevice)
    mock_device_hopper.architecture = nv.NVML_DEVICE_ARCH_HOPPER
    mock_device_hopper.supports_fp16 = True

    nv_info = NvInfo([mock_device_hopper], lambda: None)
    assert nv_info.any_needs_legacy_cuda is False


def test_any_needs_legacy_cuda_with_mixed_architectures():
    """Test that mixed architectures with one legacy returns True"""
    mock_device_pascal = MagicMock(spec=NvDevice)
    mock_device_pascal.architecture = nv.NVML_DEVICE_ARCH_PASCAL
    mock_device_pascal.supports_fp16 = False

    mock_device_ampere = MagicMock(spec=NvDevice)
    mock_device_ampere.architecture = nv.NVML_DEVICE_ARCH_AMPERE
    mock_device_ampere.supports_fp16 = True

    nv_info = NvInfo([mock_device_pascal, mock_device_ampere], lambda: None)
    assert nv_info.any_needs_legacy_cuda is True


def test_any_needs_legacy_cuda_with_no_devices():
    """Test that no devices returns False"""
    nv_info = NvInfo([], lambda: None)
    assert nv_info.any_needs_legacy_cuda is False


def test_any_needs_legacy_cuda_unavailable():
    """Test that unavailable NvInfo returns False"""
    nv_info = NvInfo.unavailable()
    assert nv_info.any_needs_legacy_cuda is False
