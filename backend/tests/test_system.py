"""Tests for system module platform detection."""

from __future__ import annotations

import platform
import sys

import system


def test_platform_flags_are_boolean():
    """Test that all platform flags are boolean values."""
    assert isinstance(system.is_mac, bool)
    assert isinstance(system.is_arm_mac, bool)
    assert isinstance(system.is_windows, bool)
    assert isinstance(system.is_linux, bool)


def test_exactly_one_platform_is_true():
    """Test that exactly one platform flag is True."""
    platform_flags = [
        system.is_mac and not system.is_arm_mac,  # x86 Mac
        system.is_arm_mac,  # ARM Mac
        system.is_windows,
        system.is_linux,
    ]
    assert sum(platform_flags) == 1, "Exactly one platform should be detected"


def test_mac_detection():
    """Test that is_mac is True when running on macOS."""
    expected = sys.platform == "darwin"
    assert system.is_mac == expected


def test_arm_mac_detection():
    """Test that is_arm_mac is True when running on ARM macOS."""
    expected = sys.platform == "darwin" and platform.machine() == "arm64"
    assert system.is_arm_mac == expected


def test_windows_detection():
    """Test that is_windows is True when running on Windows."""
    expected = sys.platform == "win32"
    assert system.is_windows == expected


def test_linux_detection():
    """Test that is_linux is True when running on Linux."""
    expected = sys.platform == "linux"
    assert system.is_linux == expected


def test_arm_mac_implies_mac():
    """Test that if is_arm_mac is True, then is_mac must also be True."""
    if system.is_arm_mac:
        assert system.is_mac, "ARM Mac should also be detected as Mac"
