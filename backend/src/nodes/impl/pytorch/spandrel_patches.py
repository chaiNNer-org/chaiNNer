from __future__ import annotations

import threading

import torch

from logger import logger

# Runtime fixes for spandrel architectures, applied without touching the
# installed package.

_applied = False
_lock = threading.Lock()

# DAT attention masks, see _patch_dat. A single entry: all blocks of a model
# share it, and consecutive tiles almost always have the same size.
_dat_mask_cache: dict[tuple, tuple[torch.Tensor, torch.Tensor]] = {}
_dat_mask_lock = threading.Lock()


def clear_spandrel_caches() -> None:
    """
    Drops cached GPU tensors. A mask for a large tile is hundreds of MB, and
    torch.cuda.empty_cache() cannot release it while it is still referenced.
    """
    with _dat_mask_lock:
        _dat_mask_cache.clear()


def _patch_dat() -> None:
    """
    DAT rebuilds its shifted-window attention masks on the CPU in every shifted
    block whenever the tile size differs from the training size (i.e. always),
    then copies them to the GPU. That is 18 CPU mask builds and host-to-device
    copies per tile, which dominates the run time on fast GPUs.

    The mask is also always float32, so adding it to bfloat16 attention scores
    promotes them to float32 and the following `attn @ v` fails. That is why DAT
    could not run in bf16 at all.

    The mask only depends on the padded size, split size and shift size, which
    are the same for every block. So it is built once per tile size, directly on
    the model's device and in the model's dtype. The forward pass still calls
    `.to(x.device)` on it, which is then a no-op.
    """
    from spandrel.architectures.DAT.__arch import DAT as dat_arch

    cls = dat_arch.Adaptive_Spatial_Attention
    original = cls.calculate_mask

    def calculate_mask(self, H: int, W: int):  # noqa: N803
        param = next(self.parameters(), None)
        if param is None:
            return original(self, H, W)

        key = (
            H,
            W,
            tuple(self.split_size),
            tuple(self.shift_size),
            param.device,
            param.dtype,
        )
        with _dat_mask_lock:
            masks = _dat_mask_cache.get(key)
            if masks is None:
                mask_0, mask_1 = original(self, H, W)
                masks = (
                    mask_0.to(param.device, param.dtype),
                    mask_1.to(param.device, param.dtype),
                )
                _dat_mask_cache.clear()
                _dat_mask_cache[key] = masks
            return masks

    cls.calculate_mask = calculate_mask


def apply_spandrel_patches() -> None:
    global _applied
    with _lock:
        if _applied:
            return
        _applied = True
        try:
            _patch_dat()
        except Exception as e:  # noqa: BLE001
            # Different spandrel version with a different layout. The model still
            # works, just without the speedup.
            logger.warning("Could not patch DAT attention masks: %s", e)
