from __future__ import annotations

import os
import sys
import tempfile

# Add the backend src directory to the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../src"))

from dependencies.store import (
    DISK_SPACE_BUFFER,
    DependencyInfo,
    calculate_required_disk_space,
    check_disk_space,
)


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


def test_disk_space_buffer_constant():
    """Test that the disk space buffer constant is reasonable"""
    # Should be at least 50 MB (for reasonable overhead)
    assert DISK_SPACE_BUFFER >= 50 * 1024 * 1024

    # Should be less than 1 GB (to be reasonable)
    assert DISK_SPACE_BUFFER <= 1 * 1024 * 1024 * 1024


def test_calculate_required_disk_space_with_estimates():
    """Test that calculate_required_disk_space works with size estimates"""
    deps = [
        DependencyInfo(
            package_name="test1",
            version="1.0.0",
            size_estimate=10 * 1024 * 1024,  # 10 MB
        ),
        DependencyInfo(
            package_name="test2",
            version="2.0.0",
            size_estimate=20 * 1024 * 1024,  # 20 MB
        ),
    ]

    required = calculate_required_disk_space(deps)

    # Should be at least the sum of estimates
    total_estimate = 30 * 1024 * 1024
    assert required >= total_estimate

    # Should include buffer and overhead (3x multiplier + buffer)
    expected = total_estimate * 3 + DISK_SPACE_BUFFER
    assert required == expected


def test_calculate_required_disk_space_without_estimates():
    """Test that calculate_required_disk_space works without size estimates"""
    deps = [
        DependencyInfo(
            package_name="test1",
            version="1.0.0",
        ),
        DependencyInfo(
            package_name="test2",
            version="2.0.0",
        ),
    ]

    required = calculate_required_disk_space(deps)

    # Should use default estimates (10 MB per package)
    # With 2 packages: 2 * 10 MB * 3 + buffer
    expected = (2 * 10 * 1024 * 1024 * 3) + DISK_SPACE_BUFFER
    assert required == expected


def test_calculate_required_disk_space_with_local_files():
    """Test that calculate_required_disk_space works with local wheel files"""
    # This tests the fallback when from_file is specified but file doesn't exist
    deps = [
        DependencyInfo(
            package_name="nonexistent",
            version="1.0.0",
            from_file="nonexistent.whl",
        ),
    ]

    required = calculate_required_disk_space(deps)

    # Should use default estimate for non-existent files
    expected = (10 * 1024 * 1024 * 3) + DISK_SPACE_BUFFER
    assert required == expected
