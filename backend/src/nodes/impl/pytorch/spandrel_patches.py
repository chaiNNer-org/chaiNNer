from __future__ import annotations

import threading

import torch
from torch import nn

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


_hip_dwconv_failed = False


def _is_depthwise_3x3(m: nn.Module) -> bool:
    return (
        isinstance(m, nn.Conv2d)
        and m.groups == m.in_channels == m.out_channels
        and m.kernel_size == (3, 3)
        and m.stride == (1, 1)
        and m.padding == (1, 1)
        and m.dilation == (1, 1)
        and m.padding_mode == "zeros"
    )


def patch_depthwise_convs(model: nn.Module) -> None:
    """
    Routes depthwise 3x3 convolutions through a custom HIP kernel on ROCm.

    MIOpen has no fast kernel for them on consumer Radeon cards: on an RX 9070 XT
    one takes ~4 ms on a 180x256x256 tensor, the custom kernel ~0.16 ms. DAT runs
    72 of them per tile, which made them its single biggest cost. Many other
    architectures (SAFMN, OmniSR, DRCT, RGT, ...) use them as well.

    Any failure (compile, launch, unsupported input) falls back to the original
    convolution. Set CHAINNER_HIP_DWCONV=0 to disable this entirely.
    """
    if getattr(model, "_chainner_dwconv_patched", False):
        return
    model._chainner_dwconv_patched = True  # type: ignore[attr-defined]

    from .hip_kernels import can_dwconv3x3, dwconv3x3, hip_kernels_available

    if _hip_dwconv_failed or not hip_kernels_available():
        return

    count = 0
    for module in model.modules():
        if not _is_depthwise_3x3(module):
            continue
        original_forward = module.forward
        cache: dict[str, object] = {}

        def forward(x, m=module, original=original_forward, cache=cache):
            global _hip_dwconv_failed
            if _hip_dwconv_failed or not can_dwconv3x3(x):
                return original(x)
            # fp32 weights in the kernel's (C, 9) layout, rebuilt if the module
            # was moved to another device or dtype
            key = (m.weight.data_ptr(), m.weight.dtype, m.weight._version)
            if cache.get("key") != key:
                cache["key"] = key
                cache["w"] = m.weight.detach().float().reshape(m.in_channels, 9).contiguous()
                cache["b"] = (
                    m.bias.detach().float().contiguous() if m.bias is not None else None
                )
            try:
                return dwconv3x3(x, cache["w"], cache["b"])  # type: ignore[arg-type]
            except Exception as e:  # noqa: BLE001
                _hip_dwconv_failed = True
                logger.warning(
                    "HIP depthwise conv kernel failed, falling back to MIOpen: %s", e
                )
                return original(x)

        module.forward = forward
        count += 1

    if count:
        logger.debug("Using the HIP kernel for %d depthwise 3x3 convolutions", count)


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
