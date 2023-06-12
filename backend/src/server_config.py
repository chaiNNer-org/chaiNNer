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

        return ServerConfig(
            port=port,
            close_after_start=close_after_start,
        )
