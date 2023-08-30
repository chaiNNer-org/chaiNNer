from dataclasses import dataclass

try:
    from ncnn_vulkan import ncnn

    use_gpu = True
except ImportError:
    from ncnn import ncnn

    use_gpu = False

from api import DropdownSetting
from system import is_arm_mac

from . import package

if not is_arm_mac and use_gpu:
    try:
        gpu_list = []
        for i in range(ncnn.get_gpu_count()):
            gpu_list.append(ncnn.get_gpu_info(i).device_name())

        package.add_setting(
            DropdownSetting(
                label="GPU",
                key="gpu_index",
                description="Which GPU to use for NCNN. This is only relevant if you have multiple GPUs.",
                options=[{"label": x, "value": str(i)} for i, x in enumerate(gpu_list)],
                default="0",
            )
        )
    except:
        pass


@dataclass(frozen=True)
class NcnnSettings:
    gpu_index: int


def get_settings() -> NcnnSettings:
    settings = package.get_settings()

    return NcnnSettings(
        gpu_index=settings.get_int("gpu_index", 0, parse_str=True),
    )
