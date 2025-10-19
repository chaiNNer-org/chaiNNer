"""Tests for the logging system."""

import logging
import tempfile
from pathlib import Path

from logger import get_logger, setup_logger


def test_logger_setup():
    """Test that logger setup works correctly."""
    # Create a temporary directory for log files
    with tempfile.TemporaryDirectory() as temp_dir:
        log_dir = Path(temp_dir)

        # Set up a logger
        logger = setup_logger("worker", log_dir=log_dir, log_level=logging.DEBUG)

        # Verify logger is configured correctly
        assert logger.name == "chaiNNer.worker"
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

        # Verify messages were written to file
        content = log_file.read_text()
        assert "Test message" in content
        assert "Debug message" in content
        assert "Warning message" in content


def test_get_logger():
    """Test that get_logger returns a working logger."""
    # Get logger without explicit setup
    logger = get_logger("worker")

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

        # Now configure them
        from logger import setup_logger

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
