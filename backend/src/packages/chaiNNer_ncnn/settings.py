from dataclasses import dataclass

try:
    from ncnn_vulkan import ncnn

    use_gpu = True
except ImportError:
    from ncnn import ncnn  # type: ignore

    use_gpu = False

from api import DropdownSetting, NodeContext, NumberSetting, ToggleSetting
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
                description="NCNN 使用的 GPU。仅在有多个 GPU 的情况下相关。",
                options=[{"label": x, "value": str(i)} for i, x in enumerate(gpu_list)],
                default="0",
            )
        )
    except Exception:
        pass

default_net_opt = ncnn.Net().opt

# 尚未测试在 ncnn_vulkan 分支中禁用 Winograd/SGEMM，因此目前仅允许在上游 ncnn 中进行。这应该在 CPU/GPU 无关的情况下正常工作，但我只测试了 CPU。对于多线程来说也是一样的，除非只有 CPU 才有意义。
if not use_gpu:
    package.add_setting(
        ToggleSetting(
            label="使用 Winograd",
            key="winograd",
            description="启用 NCNN 的 Winograd 卷积。通常更快，但使用更多内存。",
            default=default_net_opt.use_winograd_convolution,
        )
    )
    package.add_setting(
        ToggleSetting(
            label="使用 SGEMM",
            key="sgemm",
            description="启用 NCNN 的 SGEMM 卷积。通常更快，但使用更多内存。",
            default=default_net_opt.use_sgemm_convolution,
        )
    )

    package.add_setting(
        NumberSetting(
            label="线程数",
            key="threads",
            description="NCNN 的线程数。仅影响 CPU 模式。",
            default=default_net_opt.num_threads,
            min=1,
            max=default_net_opt.num_threads,
        )
    )
    package.add_setting(
        NumberSetting(
            label="块时间",
            key="blocktime",
            description="线程在进入休眠之前等待更多工作的毫秒数。较高的值可能更快；较低的值可能降低功耗和 CPU 使用率。仅影响 CPU 模式。",
            default=default_net_opt.openmp_blocktime,
            min=0,
            max=400,
        )
    )

package.add_setting(
    NumberSetting(
        label="内存预算限制（GiB）",
        key="budget_limit",
        description="NCNN 推理使用的最大内存。0 表示无限制。内存使用测量尚不完全准确；如果效果不理想，您可能需要通过试错大幅调整此预算限制。",
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


def get_settings(context: NodeContext) -> NcnnSettings:
    settings = context.settings

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
