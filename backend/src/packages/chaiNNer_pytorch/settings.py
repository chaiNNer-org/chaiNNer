from dataclasses import dataclass

import torch
from spandrel import ModelDescriptor

from amd import amd
from api import DropdownSetting, NodeContext, NumberSetting, ToggleSetting
from gpu import nvidia
from logger import logger
from system import is_arm_mac

from . import package

if not is_arm_mac:
    gpu_list = []
    for i in range(torch.cuda.device_count()):
        device_name = torch.cuda.get_device_properties(i).name
        gpu_list.append(device_name)

    package.add_setting(
        DropdownSetting(
            label="GPU",
            key="gpu_index",
            description=(
                "Which GPU to use for PyTorch. This is only relevant if you have"
                " multiple GPUs."
            ),
            options=[{"label": x, "value": str(i)} for i, x in enumerate(gpu_list)],
            default="0",
        )
    )

package.add_setting(
    ToggleSetting(
        label="Use CPU Mode",
        key="use_cpu",
        description=(
            "Use CPU for PyTorch instead of GPU. This is much slower and not"
            " recommended."
        ),
        default=False,
    ),
)

should_fp16 = False
if nvidia.is_available:
    should_fp16 = nvidia.all_support_fp16
else:
    # RDNA2 and newer do FP16 natively, and that is exactly the hardware AMD
    # ships ROCm wheels for.
    should_fp16 = is_arm_mac or amd.is_supported

package.add_setting(
    ToggleSetting(
        label="Use FP16 Mode",
        key="use_fp16",
        description=(
            "Runs PyTorch in half-precision (FP16) mode for reduced RAM usage but falls"
            " back to full-precision (FP32) mode when CPU mode is selected."
            if is_arm_mac
            else (
                "Runs PyTorch in half-precision (FP16) mode for less VRAM usage. RTX"
                " GPUs also get a speedup. DAT models, which do not support FP16, use"
                " BF16 instead on GPUs with native BF16 (RTX 30+, Radeon RX 7000+)."
                " It falls back to full-precision (FP32) mode when CPU mode is"
                " selected."
            )
        ),
        default=should_fp16,
    ),
)

package.add_setting(
    NumberSetting(
        label="Memory Budget Limit (GiB)",
        key="budget_limit",
        description="Maximum memory (VRAM if GPU, RAM if CPU) to use for PyTorch inference. 0 means no limit. Memory usage measurement is not completely accurate yet; you may need to significantly adjust this budget limit via trial-and-error if it's not having the effect you want.",
        default=0,
        min=0,
        max=1024**2,
    )
)

if nvidia.is_available:
    package.add_setting(
        ToggleSetting(
            label="Force CUDA Cache Wipe (not recommended)",
            key="force_cache_wipe",
            description="Clears PyTorch's CUDA cache after each inference. This is NOT recommended, by us or PyTorch's developers, as it basically interferes with how PyTorch is intended to work and can significantly slow down inference time. Only enable this if you're experiencing issues with VRAM allocation.",
            default=False,
        )
    )


@dataclass(frozen=True)
class PyTorchSettings:
    use_cpu: bool
    use_fp16: bool
    gpu_index: int
    budget_limit: int
    force_cache_wipe: bool = False

    # PyTorch 2.0 does not support FP16 when using CPU
    def __post_init__(self):
        if self.use_cpu and self.use_fp16:
            object.__setattr__(self, "use_fp16", False)
            logger.info("Falling back to FP32 mode.")

    @property
    def device(self) -> torch.device:
        # CPU override
        if self.use_cpu:
            device = "cpu"
        # Check for Nvidia CUDA
        elif torch.cuda.is_available() and torch.cuda.device_count() > 0:
            device = f"cuda:{self.gpu_index}"
        # Check for Apple MPS
        elif (
            hasattr(torch, "backends")
            and hasattr(torch.backends, "mps")
            and torch.backends.mps.is_built()
            and torch.backends.mps.is_available()
        ):  # type: ignore -- older pytorch versions dont support this technically
            device = "mps"
        # Check for DirectML
        elif hasattr(torch, "dml") and torch.dml.is_available():  # type: ignore
            device = "dml"
        else:
            device = "cpu"

        return torch.device(device)

    def inference_dtype(self, model: ModelDescriptor) -> torch.dtype:
        """
        The dtype to run a model in.

        Half precision is requested through the FP16 setting. Some transformer
        architectures do not work in FP16, but do in BF16, which has the same
        memory savings. Those use BF16 instead of falling back to FP32, as long
        as the GPU has fast BF16.
        """
        if not self.use_fp16:
            return torch.float32
        if model.supports_half:
            return torch.float16
        if (
            model.architecture.id in BF16_VERIFIED_ARCHITECTURES
            and model.supports_bfloat16
            and _has_fast_bf16(self.device)
        ):
            return torch.bfloat16
        return torch.float32


# spandrel's supports_bfloat16 flag is not reliable: DRCT, ATD, GRL and RGT all
# claim BF16 support but fail at inference with "expected scalar type Float but
# found BFloat16", because they build masks/biases in float32 at run time. Only
# architectures that were actually run in BF16 on tile sizes other than their
# training size are listed here. DAT needs the mask fix in spandrel_patches.
BF16_VERIFIED_ARCHITECTURES = frozenset({"DAT"})


_fast_bf16_cache: dict[torch.device, bool] = {}


def _has_fast_bf16(device: torch.device) -> bool:
    """
    Whether BF16 runs natively (matrix cores) rather than emulated, which would
    be slower than FP32.
    """
    if device.type != "cuda":
        return False
    cached = _fast_bf16_cache.get(device)
    if cached is not None:
        return cached

    result = False
    try:
        props = torch.cuda.get_device_properties(device)
        if torch.version.hip:
            # RDNA3 (gfx11), RDNA4 (gfx12) and CDNA2+ have BF16 WMMA/MFMA.
            # RDNA2 (gfx103x) does not.
            arch = str(getattr(props, "gcnArchName", "")).split(":")[0]
            result = arch.startswith(("gfx11", "gfx12", "gfx90a", "gfx94", "gfx95"))
        else:
            # Ampere and newer.
            result = props.major >= 8
    except Exception as e:  # noqa: BLE001
        logger.warning("Could not determine BF16 support: %s", e)

    _fast_bf16_cache[device] = result
    return result


def get_settings(context: NodeContext) -> PyTorchSettings:
    settings = context.settings

    return PyTorchSettings(
        use_cpu=settings.get_bool("use_cpu", False),
        use_fp16=settings.get_bool("use_fp16", False),
        gpu_index=settings.get_int("gpu_index", 0, parse_str=True),
        budget_limit=settings.get_int("budget_limit", 0, parse_str=True),
        force_cache_wipe=settings.get_bool("force_cache_wipe", False),
    )
