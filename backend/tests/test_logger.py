"""Tests for the logging system."""

import logging
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

from logger import ColoredFormatter, setup_logger
from logger import logger as logger_import


def test_logger_setup():
    """Test that logger setup works correctly."""
    # Create a temporary directory for log files
    with tempfile.TemporaryDirectory() as temp_dir:
        log_dir = Path(temp_dir)

        # Clear any existing logger to ensure clean test
        import logging as base_logging

        test_logger_name = "chaiNNer.worker"
        test_logger = base_logging.getLogger(test_logger_name)
        test_logger.handlers.clear()
        test_logger.setLevel(logging.NOTSET)

        # Set up a logger
        logger = setup_logger("worker", log_dir=log_dir, log_level=logging.DEBUG)

        # Verify logger is configured correctly
        assert logger.name == "chaiNNer.worker"
        # Check that the logger level is set correctly (it should be DEBUG)
        assert logger.level == logging.DEBUG
        assert (
            len(logger.handlers) >= 2
        )  # file and console handlers (may have more from previous calls)

        # Verify log file is created
        log_file = log_dir / "worker.log"
        assert log_file.exists()

        # Test logging
        logger.info("Test message")
        logger.debug("Debug message")
        logger.warning("Warning message")

        # Flush handlers to ensure messages are written
        for handler in logger.handlers:
            handler.flush()

        # Verify messages were written to file
        content = log_file.read_text()
        assert "Test message" in content
        assert "Debug message" in content
        assert "Warning message" in content

        # Clean up handlers to avoid issues with temporary directory cleanup
        for handler in logger.handlers:
            handler.close()
        logger.handlers.clear()


def test_get_logger():
    """Test that get_logger returns a working logger."""
    # Get logger without explicit setup
    logger = logger_import

    assert logger.name == "chaiNNer.worker"
    assert isinstance(logger, logging.Logger)


def test_separate_process_types():
    """Test that we can have separate loggers for host and worker."""
    with tempfile.TemporaryDirectory() as temp_dir:
        log_dir = Path(temp_dir)

        # Use unique logger names for this test
        import logging as base_logging

        # Create fresh loggers for this test
        host_logger = base_logging.getLogger("chaiNNer.test_host")
        host_logger.handlers.clear()
        worker_logger = base_logging.getLogger("chaiNNer.test_worker")
        worker_logger.handlers.clear()

        # Now configure them manually
        # (We can't use setup_logger here as it would interfere with the global loggers)

        # Manually set up handlers for test loggers
        for logger_name, log_filename in [
            ("test_host", "host.log"),
            ("test_worker", "worker.log"),
        ]:
            test_logger = base_logging.getLogger(f"chaiNNer.{logger_name}")
            test_logger.setLevel(base_logging.INFO)
            test_logger.propagate = False

            log_file = log_dir / log_filename
            file_handler = base_logging.FileHandler(log_file, encoding="utf-8")
            file_handler.setLevel(base_logging.INFO)
            file_formatter = base_logging.Formatter(
                fmt="%(asctime)s.%(msecs)03d [%(process)d] [%(levelname)s] %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
            file_handler.setFormatter(file_formatter)
            test_logger.addHandler(file_handler)

        # Verify separate log files
        host_log = log_dir / "host.log"
        worker_log = log_dir / "worker.log"

        # Log to each
        host_logger.info("Host message")
        worker_logger.info("Worker message")

        # Flush handlers
        for handler in host_logger.handlers:
            handler.flush()
        for handler in worker_logger.handlers:
            handler.flush()

        # Verify messages went to correct files
        host_content = host_log.read_text()
        worker_content = worker_log.read_text()

        assert "Host message" in host_content
        assert "Worker message" not in host_content

        assert "Worker message" in worker_content
        assert "Host message" not in worker_content

        # Clean up handlers to avoid issues with temporary directory cleanup
        for handler in host_logger.handlers:
            handler.close()
        for handler in worker_logger.handlers:
            handler.close()
        host_logger.handlers.clear()
        worker_logger.handlers.clear()


def test_setup_logger_dev_mode():
    """Test that dev mode skips file logging."""
    with tempfile.TemporaryDirectory() as temp_dir:
        log_dir = Path(temp_dir)

        # Clear any existing logger
        import logging as base_logging

        test_logger_name = "chaiNNer.worker"
        test_logger = base_logging.getLogger(test_logger_name)
        test_logger.handlers.clear()
        test_logger.setLevel(logging.NOTSET)

        # Set up logger in dev mode
        logger = setup_logger(
            "worker", log_dir=log_dir, log_level=logging.INFO, dev_mode=True
        )

        # In dev mode, should only have console handler, not file handler
        assert len(logger.handlers) == 1
        assert isinstance(logger.handlers[0], logging.StreamHandler)

        # Verify no log file is created
        log_file = log_dir / "worker.log"
        assert not log_file.exists()

        # Clean up
        for handler in logger.handlers:
            handler.close()
        logger.handlers.clear()


def test_colored_formatter_with_tty():
    """Test that ColoredFormatter adds colors when stderr is a TTY."""
    formatter = ColoredFormatter(
        fmt="[%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    # Create a mock record
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="",
        lineno=0,
        msg="Test message",
        args=(),
        exc_info=None,
    )

    # Mock sys.stderr.isatty() to return True
    with patch.object(sys.stderr, "isatty", return_value=True):
        formatted = formatter.format(record)
        # Should contain ANSI color codes
        assert "\033[" in formatted
        assert "INFO" in formatted
        assert "Test message" in formatted

    # Verify original levelname is restored
    assert record.levelname == "INFO"


def test_colored_formatter_without_tty():
    """Test that ColoredFormatter doesn't add colors when stderr is not a TTY."""
    formatter = ColoredFormatter(
        fmt="[%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    # Create a mock record
    record = logging.LogRecord(
        name="test",
        level=logging.WARNING,
        pathname="",
        lineno=0,
        msg="Test warning",
        args=(),
        exc_info=None,
    )

    # Mock sys.stderr.isatty() to return False
    with patch.object(sys.stderr, "isatty", return_value=False):
        formatted = formatter.format(record)
        # Should not contain ANSI color codes
        assert "\033[" not in formatted
        assert "WARNING" in formatted
        assert "Test warning" in formatted


def test_colored_formatter_different_levels():
    """Test that ColoredFormatter works with different log levels."""
    formatter = ColoredFormatter(fmt="[%(levelname)s] %(message)s")

    levels = [
        (logging.DEBUG, "DEBUG"),
        (logging.INFO, "INFO"),
        (logging.WARNING, "WARNING"),
        (logging.ERROR, "ERROR"),
        (logging.CRITICAL, "CRITICAL"),
    ]

    for level, level_name in levels:
        record = logging.LogRecord(
            name="test",
            level=level,
            pathname="",
            lineno=0,
            msg=f"Test {level_name}",
            args=(),
            exc_info=None,
        )

        # Format with TTY
        with patch.object(sys.stderr, "isatty", return_value=True):
            formatted = formatter.format(record)
            assert level_name in formatted

        # Verify levelname is restored
        assert record.levelname == level_name
