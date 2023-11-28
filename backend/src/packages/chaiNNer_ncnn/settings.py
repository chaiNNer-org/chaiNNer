from dataclasses import dataclass

try:
    from ncnn_vulkan import ncnn

    use_gpu = True
except ImportError:
    from ncnn import ncnn  # type: ignore

    use_gpu = False

from api import DropdownSetting, NumberSetting, ToggleSetting
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
    except Exception:
        pass

default_net_opt = ncnn.Net().opt

# Haven't tested disabling Winograd/SGEMM in the ncnn_vulkan fork, so only
# allow it with upstream ncnn for now. It should work fine regardless of
# CPU/GPU, but I only tested with CPU. Ditto for multithreading, except it
# only makes sense for CPU.
if not use_gpu:
    package.add_setting(
        ToggleSetting(
            label="Use Winograd",
            key="winograd",
            description="Enable Winograd convolution for NCNN. Typically faster but uses more memory.",
            default=default_net_opt.use_winograd_convolution,
        )
    )
    package.add_setting(
        ToggleSetting(
            label="Use SGEMM",
            key="sgemm",
            description="Enable SGEMM convolution for NCNN. Typically faster but uses more memory.",
            default=default_net_opt.use_sgemm_convolution,
        )
    )

    package.add_setting(
        NumberSetting(
            label="Thread Count",
            key="threads",
            description="Number of threads for NCNN. Only affects CPU mode.",
            default=default_net_opt.num_threads,
            min=1,
            max=default_net_opt.num_threads,
        )
    )
    package.add_setting(
        NumberSetting(
            label="Block Time",
            key="blocktime",
            description="Milliseconds for threads to busy-wait for more work before going to sleep. Higher values may be faster; lower values may decrease power consumption and CPU usage. Only affects CPU mode.",
            default=default_net_opt.openmp_blocktime,
            min=0,
            max=400,
        )
    )

package.add_setting(
    NumberSetting(
        label="Memory Budget Limit (GiB)",
        key="budget_limit",
        description="Maximum memory to use for NCNN inference. 0 means no limit.",
        default=0,
        min=0,
        max=1024**2,
    )
)


@dataclass(frozen=True)
class NcnnSettings:
    gpu_index: int
    winograd: bool
    sgemm: bool
    threads: int
    blocktime: int
    budget_limit: int


def get_settings() -> NcnnSettings:
    settings = package.get_settings()

    return NcnnSettings(
        gpu_index=settings.get_int("gpu_index", 0, parse_str=True),
        winograd=settings.get_bool(
            "winograd", default_net_opt.use_winograd_convolution
        ),
        sgemm=settings.get_bool("sgemm", default_net_opt.use_sgemm_convolution),
        threads=settings.get_int(
            "threads", default_net_opt.num_threads, parse_str=True
        ),
        blocktime=settings.get_int(
            "blocktime", default_net_opt.openmp_blocktime, parse_str=True
        ),
        budget_limit=settings.get_int("budget_limit", 0, parse_str=True),
    )
