#!/usr/bin/env python3
"""
Demo script to showcase the new logging system.

This script demonstrates how the logging system works for both host and worker processes.
"""

import sys
import time
from pathlib import Path

# Add backend/src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from logger import setup_logger


def demo_host_worker_logging():
    """Demonstrate separate logging for host and worker processes."""
    print("=" * 60)
    print("ChaiNNer Backend Logging System Demo")
    print("=" * 60)
    print()

    # Set up loggers for both processes
    print("Setting up loggers...")
    host_logger = setup_logger("host")
    worker_logger = setup_logger("worker")

    print(f"Host logger: {host_logger.name}")
    print(f"Worker logger: {worker_logger.name}")
    print()

    # Simulate some host activity
    print("Simulating host process activity...")
    host_logger.info("Host process starting up")
    host_logger.debug("Loading configuration...")
    host_logger.info("Starting worker process")
    time.sleep(0.1)

    # Simulate some worker activity
    print("Simulating worker process activity...")
    worker_logger.info("Worker process initialized")
    worker_logger.debug("Loading packages...")
    worker_logger.info("Loading nodes...")
    worker_logger.warning("Some node had an issue")
    time.sleep(0.1)

    # Simulate an error
    print("Simulating an error in worker...")
    try:
        raise ValueError("Something went wrong!")
    except Exception as e:
        worker_logger.error("Error during execution: %s", str(e))

    # More host activity
    print("Simulating more host activity...")
    host_logger.info("Worker ready")
    host_logger.info("Backend is ready for requests")

    print()
    print("=" * 60)
    print("Demo complete!")
    print("=" * 60)
    print()

    # Show where the logs are
    log_dir = Path("/tmp/chaiNNer/logs")
    if log_dir.exists():
        print(f"Log files created in: {log_dir}")
        print()
        for log_file in sorted(log_dir.glob("*.log")):
            print(f"  - {log_file.name}")
        print()
        print("You can view the logs with:")
        print(f"  tail -f {log_dir}/host.log")
        print(f"  tail -f {log_dir}/worker.log")
        print()
        print("Or view both together sorted by timestamp:")
        print(f"  cat {log_dir}/host.log {log_dir}/worker.log | sort")


if __name__ == "__main__":
    demo_host_worker_logging()
