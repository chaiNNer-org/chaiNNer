"""Tests for server configuration parsing."""

from __future__ import annotations

import sys

from server_config import ServerConfig


def test_server_config_default_values():
    """Test ServerConfig with default values."""
    # Mock sys.argv for the test
    original_argv = sys.argv
    try:
        sys.argv = ["server.py"]
        config = ServerConfig.parse_argv()

        assert config.port == 8000
        assert config.close_after_start is False
        assert config.install_builtin_packages is False
        assert config.error_on_failed_node is False
        assert config.storage_dir is None
        assert config.logs_dir is None
        assert config.trace is False
    finally:
        sys.argv = original_argv


def test_server_config_custom_port():
    """Test ServerConfig with custom port."""
    original_argv = sys.argv
    try:
        sys.argv = ["server.py", "9000"]
        config = ServerConfig.parse_argv()

        assert config.port == 9000
    finally:
        sys.argv = original_argv


def test_server_config_close_after_start():
    """Test ServerConfig with close_after_start flag."""
    original_argv = sys.argv
    try:
        sys.argv = ["server.py", "--close-after-start"]
        config = ServerConfig.parse_argv()

        assert config.close_after_start is True
    finally:
        sys.argv = original_argv


def test_server_config_install_builtin_packages():
    """Test ServerConfig with install_builtin_packages flag."""
    original_argv = sys.argv
    try:
        sys.argv = ["server.py", "--install-builtin-packages"]
        config = ServerConfig.parse_argv()

        assert config.install_builtin_packages is True
    finally:
        sys.argv = original_argv


def test_server_config_error_on_failed_node():
    """Test ServerConfig with error_on_failed_node flag."""
    original_argv = sys.argv
    try:
        sys.argv = ["server.py", "--error-on-failed-node"]
        config = ServerConfig.parse_argv()

        assert config.error_on_failed_node is True
    finally:
        sys.argv = original_argv


def test_server_config_storage_dir():
    """Test ServerConfig with custom storage directory."""
    original_argv = sys.argv
    try:
        sys.argv = ["server.py", "--storage-dir", "/tmp/test-storage"]
        config = ServerConfig.parse_argv()

        assert config.storage_dir == "/tmp/test-storage"
    finally:
        sys.argv = original_argv


def test_server_config_logs_dir():
    """Test ServerConfig with custom logs directory."""
    original_argv = sys.argv
    try:
        sys.argv = ["server.py", "--logs-dir", "/tmp/test-logs"]
        config = ServerConfig.parse_argv()

        assert config.logs_dir == "/tmp/test-logs"
    finally:
        sys.argv = original_argv


def test_server_config_trace():
    """Test ServerConfig with trace flag."""
    original_argv = sys.argv
    try:
        sys.argv = ["server.py", "--trace"]
        config = ServerConfig.parse_argv()

        assert config.trace is True
    finally:
        sys.argv = original_argv


def test_server_config_multiple_flags():
    """Test ServerConfig with multiple flags and arguments."""
    original_argv = sys.argv
    try:
        sys.argv = [
            "server.py",
            "7000",
            "--close-after-start",
            "--install-builtin-packages",
            "--error-on-failed-node",
            "--storage-dir",
            "/custom/storage",
            "--logs-dir",
            "/custom/logs",
            "--trace",
        ]
        config = ServerConfig.parse_argv()

        assert config.port == 7000
        assert config.close_after_start is True
        assert config.install_builtin_packages is True
        assert config.error_on_failed_node is True
        assert config.storage_dir == "/custom/storage"
        assert config.logs_dir == "/custom/logs"
        assert config.trace is True
    finally:
        sys.argv = original_argv
