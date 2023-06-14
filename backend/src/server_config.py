import sys
from dataclasses import dataclass, field
from typing import List


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

    install: List[str] = field(default_factory=list)
    """
    List of packages to install before readying the server.

    Usage: `--install=<package>,<package> ...`
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

        install: List[str] = []
        for arg in argv.copy():
            if arg.startswith("--install="):
                install = arg.split("=")[1].split(",")
                argv.remove(arg)
                break

        return ServerConfig(
            port=port,
            close_after_start=close_after_start,
            install=install,
        )
