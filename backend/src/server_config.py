import sys
from dataclasses import dataclass


@dataclass
class ServerConfig:
    port: int
    """Port to run the server on."""

    close_after_start: bool = False
    """
    Whether to close the server after starting it.

    This is useful for testing the server.

    Usage: `--close-after-start`
    """

    install_builtin_packages: bool = False
    """
    Whether to install all built-in packages.

    Usage: `--install-builtin-packages`
    """

    @staticmethod
    def parse_argv() -> "ServerConfig":
        # Remove the first argument, which is the script name.
        argv = sys.argv[1:]

        try:
            port = int(argv[0]) or 8000
            argv = argv[1:]
        except:
            port = 8000

        close_after_start = False
        if "--close-after-start" in argv:
            close_after_start = True
            argv.remove("--close-after-start")

        install_builtin_packages = False
        if "--install-builtin-packages" in argv:
            install_builtin_packages = True
            argv.remove("--install-builtin-packages")

        return ServerConfig(
            port=port,
            close_after_start=close_after_start,
            install_builtin_packages=install_builtin_packages,
        )
