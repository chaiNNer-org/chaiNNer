"""
Centralized logging module for chaiNNer backend.

This module provides a unified logging interface for both the host and worker
processes, with proper file-based logging that persists independently of the
frontend.
"""

from __future__ import annotations

import logging
import logging.handlers
import os
import sys
from pathlib import Path
from typing import Literal

# ANSI color codes for console output
COLORS = {
    "DEBUG": "\033[36m",  # Cyan
    "INFO": "\033[32m",  # Green
    "WARNING": "\033[33m",  # Yellow
    "ERROR": "\033[31m",  # Red
    "CRITICAL": "\033[35m",  # Magenta
    "RESET": "\033[0m",  # Reset
}


class ColoredFormatter(logging.Formatter):
    """Custom formatter that adds colors to console output."""

    def format(self, record: logging.LogRecord) -> str:
        # Add color to the levelname
        levelname = record.levelname
        if levelname in COLORS and sys.stderr.isatty():
            colored_levelname = f"{COLORS[levelname]}{levelname}{COLORS['RESET']}"
            record.levelname = colored_levelname

        result = super().format(record)

        # Restore original levelname
        record.levelname = levelname
        return result


ProcessType = Literal["host", "worker"]

# Global flag to track if logger has been initialized
_logger_initialized: dict[str, bool] = {}


def setup_logger(
    process_type: ProcessType,
    log_dir: Path | None = None,
    log_level: int = logging.INFO,
    dev_mode: bool = False,
) -> logging.Logger:
    """
    Set up a logger for the specified process type.

    Args:
        process_type: Either "host" or "worker" to identify which process is
            logging
        log_dir: Directory where log files should be stored. If None, uses a
            default location.
        log_level: The logging level (default: INFO)
        dev_mode: If True, disables file logging and only logs to console

    Returns:
        A configured logger instance
    """
    # Determine log directory
    if log_dir is None:
        # Use the same location as the frontend logs
        import tempfile

        # Use the same logic as frontend's getLogsFolder() function
        if os.name == "nt":  # Windows
            user_data = os.environ.get("APPDATA", os.path.expanduser("~"))
            log_dir = Path(user_data) / "chaiNNer" / "logs"
        elif os.name == "posix":  # macOS/Linux
            if sys.platform == "darwin":  # macOS
                log_dir = (
                    Path.home()
                    / "Library"
                    / "Application Support"
                    / "chaiNNer"
                    / "logs"
                )
            else:  # Linux
                log_dir = Path.home() / ".config" / "chaiNNer" / "logs"
        else:
            # Fallback to temp directory
            log_dir = Path(tempfile.gettempdir()) / "chaiNNer" / "logs"

    # Create log directory if it doesn't exist
    log_dir.mkdir(parents=True, exist_ok=True)

    # Create logger with a unique name for this process type
    logger_name = f"chaiNNer.{process_type}"
    logger = logging.getLogger(logger_name)

    # Mark as initialized
    _logger_initialized[logger_name] = True

    # Avoid adding handlers multiple times if called again
    if logger.handlers:
        return logger

    logger.setLevel(log_level)
    logger.propagate = False

    # Console handler with colors
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setLevel(log_level)

    # Console format is simpler and colored
    console_formatter = ColoredFormatter(
        fmt="[%(asctime)s] [%(process)d] [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    console_handler.setFormatter(console_formatter)

    # Add console handler
    logger.addHandler(console_handler)

    # File handler with rotation (keeps last 5 files, 10MB each)
    # Skip file logging in dev mode
    if not dev_mode:
        log_file = log_dir / f"{process_type}.log"
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setLevel(log_level)

        # File format includes timestamp with milliseconds for correlation
        file_formatter = logging.Formatter(
            fmt=(
                "%(asctime)s.%(msecs)03d [%(process)d] [%(levelname)s] " "%(message)s"
            ),
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        file_handler.setFormatter(file_formatter)

        # Add file handler
        logger.addHandler(file_handler)

        logger.info(
            "Logger initialized for %s process. Log file: %s",
            process_type,
            log_file,
        )
    else:
        logger.info(
            "Logger initialized for %s process (dev mode - no file logging)",
            process_type,
        )

    return logger


# Create a single logger instance that auto-detects the process type
def _get_process_type() -> ProcessType:
    """Get the process type from environment variable."""
    process_type_str = os.environ.get("CHAINNER_PROCESS_TYPE", "worker")
    return "host" if process_type_str == "host" else "worker"


def _get_logger() -> logging.Logger:
    """Get or create the logger for the current process type."""
    process_type = _get_process_type()
    logger_name = f"chaiNNer.{process_type}"
    logger = logging.getLogger(logger_name)

    # If logger hasn't been set up yet, set it up with defaults
    if not _logger_initialized.get(logger_name, False):
        setup_logger(process_type)

    return logger


# Export the logger instance
logger = _get_logger()
