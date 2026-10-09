from __future__ import annotations

import sys


def preload_rocm_torch() -> None:
    """
    Import torch before anything else loads native libraries into this process.

    The ROCm build of torch calls rocm_sdk.initialize_process() at import time,
    which ctypes-loads the HIP runtime DLLs. On Windows that only succeeds while
    the process is still clean: other packages that ship their own native
    libraries can grab a conflicting copy of a shared dependency first.

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
        import os
        from pathlib import Path

        def _setup_miopen_cache() -> None:
            appdata = os.environ.get("APPDATA")
            if not appdata:
                return

            db = Path(appdata) / "chaiNNer" / "miopen" / "db"

            try:
                db.mkdir(parents=True, exist_ok=True)
            except OSError:
                return

            os.environ.setdefault("TORCH_BLAS_PREFER_HIPBLASLT", "1")
            os.environ.setdefault("MIOPEN_USER_DB_PATH", str(db))
            os.environ.setdefault("MIOPEN_CUSTOM_CACHE_DIR", str(db))
            os.environ.setdefault("MIOPEN_FIND_MODE", "FAST")

        # The ROCm runtime on Windows keeps freed allocations in its own cache,
        # sized at 1/8 of VRAM by default (2 GB on a 16 GB card). PyTorch's
        # caching allocator already does the same job, so torch.cuda.empty_cache()
        # hands memory back to that second cache instead of to the system, and
        # an idle chaiNNer keeps holding it. 64 MB makes empty_cache() actually
        # free VRAM, with no measurable speed difference.
        os.environ.setdefault("GPU_RESOURCE_CACHE_SIZE", "64")

        _setup_miopen_cache()

        import torch  # noqa: F401

    except Exception:  # noqa: BLE001
        # torch simply isn't installed yet, or it is broken. Either way, the
        # regular import further down the line will report it properly.
        pass

def warm_up_miopen_in_background() -> None:
    """
    Load MIOpen's convolution libraries on a background thread.

    The first convolution in a process makes MIOpen load its Composable Kernel
    library (MIOpenCKGroupedConv_*.dll). The HIP runtime then registers all of
    its ~500 compressed code objects one after another, which takes ~15 s on
    Windows. Doing it right after startup hides that delay instead of adding it
    to the first chain run.

    Set CHAINNER_MIOPEN_WARMUP=0 to disable. No-op without a ROCm build of torch.
    """
    if sys.platform != "win32":
        return

    import os

    if os.environ.get("CHAINNER_MIOPEN_WARMUP", "1") == "0":
        return

    def warm_up() -> None:
        try:
            import time

            import torch
            import torch.nn.functional as F  # noqa: N812

            if torch.version.hip is None or not torch.cuda.is_available():
                return

            from logger import logger

            start = time.perf_counter()
            with torch.inference_mode():
                x = torch.zeros(1, 8, 16, 16, device="cuda")
                w = torch.zeros(8, 8, 3, 3, device="cuda")
                F.conv2d(x, w, padding=1)
                torch.cuda.synchronize()
                del x, w
            torch.cuda.empty_cache()
            logger.info(
                "MIOpen warmed up in %.1f s", time.perf_counter() - start
            )
        except Exception as e:  # noqa: BLE001
            try:
                from logger import logger

                logger.warning("MIOpen warm-up failed: %s", e)
            except Exception:  # noqa: BLE001
                pass

    import threading

    threading.Thread(target=warm_up, name="miopen-warmup", daemon=True).start()
