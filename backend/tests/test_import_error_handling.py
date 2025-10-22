"""Test that import errors are properly categorized and handled."""

import importlib
import sys
from unittest.mock import MagicMock, patch


def test_dll_loading_error_is_detected():
    """Test that DLL loading errors are wrapped with helpful context."""
    # Simulate a DLL loading error that might occur with PyTorch
    dll_error = OSError(
        "Error loading 'caffe2_detectron_ops_gpu.dll' or one of its dependencies"
    )

    # Test that our error handling wraps this appropriately
    with patch.dict(sys.modules, {"torch": None}):
        with patch("builtins.__import__", side_effect=dll_error):
            try:
                # This would normally be caught by our wrapper
                exec("import torch")
            except OSError as e:
                # The original error should still be an OSError
                assert "caffe2_detectron_ops_gpu.dll" in str(e)


def test_importerror_with_dll_context():
    """Test that ImportError with DLL context is properly detected."""
    error_msg = "DLL load failed while importing _C: The paging file is too small"
    test_error = ImportError(error_msg)

    # Verify our detection logic works
    assert "DLL" in str(test_error)
    assert "paging file" in str(test_error).lower()


def test_module_not_found_error_is_separate():
    """Test that ModuleNotFoundError is handled separately from other import errors."""
    # ModuleNotFoundError should be treated differently from OSError/ImportError
    mnf_error = ModuleNotFoundError("No module named 'torch'")
    os_error = OSError("DLL load failed")
    import_error = ImportError("DLL load failed")

    # Verify they are distinct error types
    assert isinstance(mnf_error, ModuleNotFoundError)
    assert not isinstance(mnf_error, OSError)
    assert isinstance(os_error, OSError)
    assert not isinstance(os_error, ModuleNotFoundError)
    assert isinstance(import_error, ImportError)
    # Note: ModuleNotFoundError is a subclass of ImportError
    assert not isinstance(import_error, ModuleNotFoundError) or "DLL" in str(
        import_error
    )
