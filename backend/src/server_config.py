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

    @staticmethod
    def parse_argv() -> "ServerConfig":
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

        parsed = parser.parse_args()

        return ServerConfig(
            port=parsed.port,
            close_after_start=parsed.close_after_start,
            install_builtin_packages=parsed.install_builtin_packages,
            error_on_failed_node=parsed.error_on_failed_node,
        )
