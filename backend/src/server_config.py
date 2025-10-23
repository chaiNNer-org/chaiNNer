from __future__ import annotations

import argparse
from dataclasses import dataclass


@dataclass
class ServerConfig:
    port: int
    """Port to run the server on."""

    close_after_start: bool
    """
    Whether to close the server after starting it.

    This is useful for testing the server.

    Usage: `--close-after-start`
    """

    install_builtin_packages: bool
    """
    Whether to install all built-in packages.

    Usage: `--install-builtin-packages`
    """

    error_on_failed_node: bool
    """
    Errors and exits the server with a non-zero exit code if a node fails to import.

    Usage: `--error-on-failed-node`
    """

    storage_dir: str | None
    """
    Directory to store for nodes to store files in.

    Usage: `--storage-dir /foo/bar`
    """

    logs_dir: str | None
    """
    Directory to store log files in.

    Usage: `--logs-dir /foo/bar`
    """

    trace: bool
    """
    Whether to enable tracing using VizTracer.

    Usage: `--trace`
    """

    @staticmethod
    def parse_argv() -> ServerConfig:
        parser = argparse.ArgumentParser(description="ChaiNNer's server.")
        parser.add_argument(
            "port",
            type=int,
            nargs="?",
            default=8000,
            help="Port to run the server on.",
        )
        parser.add_argument(
            "--close-after-start",
            action="store_true",
            help="Close the server after starting Useful for CI.",
        )
        parser.add_argument(
            "--install-builtin-packages",
            action="store_true",
            help="Install all built-in packages.",
        )
        parser.add_argument(
            "--error-on-failed-node",
            action="store_true",
            help="Errors and exits the server with a non-zero exit code if a node fails to import.",
        )
        parser.add_argument(
            "--storage-dir",
            type=str,
            help="Directory to store for nodes to store files in.",
        )
        parser.add_argument(
            "--logs-dir",
            type=str,
            help="Directory to store log files in.",
        )
        parser.add_argument(
            "--trace",
            action="store_true",
            help="Enable tracing using VizTracer.",
        )

        parsed = parser.parse_args()

        return ServerConfig(
            port=parsed.port,
            close_after_start=parsed.close_after_start,
            install_builtin_packages=parsed.install_builtin_packages,
            error_on_failed_node=parsed.error_on_failed_node,
            storage_dir=parsed.storage_dir or None,
            logs_dir=parsed.logs_dir or None,
            trace=parsed.trace,
        )
