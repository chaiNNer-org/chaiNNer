from dataclasses import dataclass

import torch
from sanic.log import logger

from api import DropdownSetting, NodeContext, NumberSetting, ToggleSetting
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
        label="使用 CPU 模式",
        key="use_cpu",
        description=(
            "在 PyTorch 中使用 CPU 而不是 GPU。这会慢得多，不建议使用。"
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
        label="使用 FP16 模式",
        key="use_fp16",
        description=(
            "在 PyTorch 中运行半精度 (FP16) 模式，以减少 RAM 使用，但在选择 CPU 模式时回退到全精度 (FP32) 模式。"
            if is_arm_mac
            else (
                "在 PyTorch 中运行半精度 (FP16) 模式，以减少 VRAM 使用。RTX"
                " GPU 也会加速。在选择 CPU 模式时回退到全精度 (FP32)"
                " 模式。"
            )
        ),
        default=should_fp16,
    ),
)

package.add_setting(
    NumberSetting(
        label="内存预算限制（GiB）",
        key="budget_limit",
        description="用于 PyTorch 推理的最大内存（如果使用 GPU，则为 VRAM；如果使用 CPU，则为 RAM）。0 表示没有限制。内存使用测量尚不完全准确；如果没有产生预期效果，您可能需要通过反复试验显著调整此预算限制。",
        default=0,
        min=0,
        max=1024**2,
    )
)


@dataclass(frozen=True)
class PyTorchSettings:
    use_cpu: bool
    use_fp16: bool
    gpu_index: int
    budget_limit: int

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
        budget_limit=settings.get_int("budget_limit", 0, parse_str=True),
    )
