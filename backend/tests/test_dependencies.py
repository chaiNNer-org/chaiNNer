from __future__ import annotations

import os
import sys
import tempfile

# Add the backend src directory to the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))

from dependencies.store import MIN_FREE_DISK_SPACE, check_disk_space


def test_check_disk_space():
    """Test that check_disk_space returns valid values"""
    total, free = check_disk_space()

    # Should return non-negative values
    assert total >= 0
    assert free >= 0

    # Total should be greater than or equal to free space
    # (except when we return default values for unsupported systems)
    if total > 0:
        assert total >= free


def test_check_disk_space_with_path():
    """Test that check_disk_space works with a specific path"""
    with tempfile.TemporaryDirectory() as tmpdir:
        total, free = check_disk_space(tmpdir)

        # Should return non-negative values
        assert total >= 0
        assert free >= 0


def test_min_free_disk_space_constant():
    """Test that the minimum free disk space constant is reasonable"""
    # Should be at least 100 MB
    assert MIN_FREE_DISK_SPACE >= 100 * 1024 * 1024

    # Should be less than 10 GB (to be reasonable)
    assert MIN_FREE_DISK_SPACE <= 10 * 1024 * 1024 * 1024
