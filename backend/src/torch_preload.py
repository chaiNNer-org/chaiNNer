from __future__ import annotations

import sys


def preload_rocm_torch() -> None:
    """
    Import torch before anything else loads native libraries into this process.

    The ROCm build of torch calls rocm_sdk.initialize_process() at import time,
    which ctypes-loads the HIP runtime DLLs. On Windows that only succeeds while
    the process is still clean: other packages that ship their own native
    libraries (pillow-avif-plugin is the one that bites here, but OpenCV and
    numba are in the same family) can grab a conflicting copy of a shared
    dependency first, and then the HIP DLL is found but its initialization
    routine fails with:

        OSError: [WinError 1114] A dynamic link library (DLL) initialization
        routine failed

    The node modules are imported in alphabetical order, so chaiNNer_standard's
    image IO — and its `import pillow_avif` — always lands before
    chaiNNer_pytorch. Claiming the DLLs up front sidesteps the whole race.

    This is a no-op when torch is not installed, is not a ROCm build, or when
    the platform is not Windows.
    """
    if sys.platform != "win32":
        return

    try:
        from amd import amd
    except Exception:  # noqa: BLE001
        return

    if not amd.is_supported:
        return

    try:
        import torch  # noqa: F401
    except Exception:  # noqa: BLE001
        # torch simply isn't installed yet, or it is broken. Either way, the
        # regular import further down the line will report it properly.
        pass
