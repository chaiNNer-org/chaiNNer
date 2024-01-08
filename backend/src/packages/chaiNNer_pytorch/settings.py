from dataclasses import dataclass

import torch
from sanic.log import logger

from api import DropdownSetting, NodeContext, ToggleSetting
from gpu import get_nvidia_helper
from system import is_arm_mac

from . import package

nv = get_nvidia_helper()

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
if nv is not None:
    should_fp16 = nv.supports_fp16()
else:
    should_fp16 = is_arm_mac

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
                " GPUs also get a speedup. It falls back to full-precision (FP32)"
                " mode when CPU mode is selected."
            )
        ),
        default=should_fp16,
    ),
)


@dataclass(frozen=True)
class PyTorchSettings:
    use_cpu: bool
    use_fp16: bool
    gpu_index: int

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


def get_settings(context: NodeContext) -> PyTorchSettings:
    settings = context.settings

    return PyTorchSettings(
        use_cpu=settings.get_bool("use_cpu", False),
        use_fp16=settings.get_bool("use_fp16", False),
        gpu_index=settings.get_int("gpu_index", 0, parse_str=True),
    )
