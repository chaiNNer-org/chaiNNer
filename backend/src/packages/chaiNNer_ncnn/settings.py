from dataclasses import dataclass

try:
    from ncnn_vulkan import ncnn

    use_gpu = True
except ImportError:
    from ncnn import ncnn

    use_gpu = False

from api import DropdownSetting, ToggleSetting
from system import is_arm_mac

from . import package

if not is_arm_mac and use_gpu:
    try:
        gpu_list = [
            ncnn.get_gpu_info(i).device_name() for i in range(ncnn.get_gpu_count())
        ]

        package.add_setting(
            DropdownSetting(
                label="GPU",
                key="gpu_index",
                description="Which GPU to use for NCNN. This is only relevant if you have multiple GPUs.",
                options=[{"label": x, "value": str(i)} for i, x in enumerate(gpu_list)],
                default="0",
            )
        )
    except Exception:
        pass

# Haven't tested disabling Winograd/SGEMM in the ncnn_vulkan fork, so only
# allow it with upstream ncnn for now. It should work fine regardless of
# CPU/GPU, but I only tested with CPU.
if not use_gpu:
    package.add_setting(
        ToggleSetting(
            label="Use Winograd",
            key="winograd",
            description="Enable Winograd convolution for NCNN. Typically faster but uses more memory.",
            default=True,
        )
    )
    package.add_setting(
        ToggleSetting(
            label="Use SGEMM",
            key="sgemm",
            description="Enable SGEMM convolution for NCNN. Typically faster but uses more memory.",
            default=True,
        )
    )


@dataclass(frozen=True)
class NcnnSettings:
    gpu_index: int
    winograd: bool
    sgemm: bool


def get_settings() -> NcnnSettings:
    settings = package.get_settings()

    return NcnnSettings(
        gpu_index=settings.get_int("gpu_index", 0, parse_str=True),
        winograd=settings.get_bool("winograd", True),
        sgemm=settings.get_bool("sgemm", True),
    )
