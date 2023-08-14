from sanic.log import logger

from api import (
    KB,
    MB,
    CacheSetting,
    Dependency,
    DropdownSetting,
    ToggleSetting,
    add_package,
)
from gpu import get_nvidia_helper, nvidia_is_available
from system import is_arm_mac

general = "ONNX uses .onnx models to upscale images."
conversion = "It also helps to convert between PyTorch and NCNN."

if is_arm_mac:
    package_description = f"{general} {conversion} However, it does not support CoreML."
    inst_hint = general
else:
    package_description = (
        f"{general} {conversion} It is fastest when CUDA is supported. If TensorRT is"
        " installed on the system, it can also be configured to use that."
    )
    inst_hint = f"{general} It does not support AMD GPUs."


def get_onnx_runtime():
    if nvidia_is_available:
        return Dependency(
            display_name="ONNX Runtime (GPU)",
            pypi_name="onnxruntime-gpu",
            version="1.15.1",
            size_estimate=120 * MB,
            import_name="onnxruntime",
        )
    else:
        return Dependency(
            display_name="ONNX Runtime",
            pypi_name="onnxruntime",
            version="1.15.1",
            size_estimate=6 * MB,
        )


package = add_package(
    __file__,
    id="chaiNNer_onnx",
    name="ONNX",
    description=package_description,
    dependencies=[
        Dependency(
            display_name="ONNX",
            pypi_name="onnx",
            version="1.14.0",
            size_estimate=12 * MB,
        ),
        Dependency(
            display_name="ONNX Optimizer",
            pypi_name="onnxoptimizer",
            version="0.3.13",
            size_estimate=300 * KB,
        ),
        get_onnx_runtime(),
        Dependency(
            display_name="Protobuf",
            pypi_name="protobuf",
            version="3.20.2",
            size_estimate=500 * KB,
        ),
        Dependency(
            display_name="Numba",
            pypi_name="numba",
            version="0.56.3",
            size_estimate=2.5 * MB,
        ),
        Dependency(
            display_name="re2",
            pypi_name="google-re2",
            version="1.0",
            size_estimate=275 * KB,
            import_name="re2",
        ),
    ],
    icon="ONNX",
    color="#63B3ED",
)

if not is_arm_mac:
    nv = get_nvidia_helper()
    gpu_list = nv.list_gpus() if nv is not None else []

    package.add_setting(
        DropdownSetting(
            label="ONNX GPU",
            key="gpu",
            description="Which GPU to use for ONNX. This is only relevant if you have multiple GPUs.",
            options=[{"label": x, "value": str(i)} for i, x in enumerate(gpu_list)],
            default="0",
            disabled=not nvidia_is_available or len(gpu_list) <= 1,
        )
    )

execution_providers = []
try:
    import onnxruntime as ort

    execution_providers = ort.get_available_providers()
except:
    pass

package.add_setting(
    DropdownSetting(
        label="ONNX Execution Provider",
        key="execution_provider",
        description="What provider to use for ONNX.",
        options=[
            {"label": x.replace("ExecutionProvider", ""), "value": x}
            for x in execution_providers
        ],
        default=execution_providers[0],
        disabled=is_arm_mac or len(execution_providers) <= 1,
    )
)

package.add_setting(
    CacheSetting(
        label="ONNX Cache",
        key="onnx-tensorrt-cache",
        description="Whether to cache ONNX models. This can speed up subsequent runs.",
        default=False,
        disabled=is_arm_mac or "TensorrtExecutionProvider" not in execution_providers,
    )
)

package.add_setting(
    ToggleSetting(
        label="TensorRT FP16 Mode",
        key="tensorrt_fp16_mode",
        description="Runs TensorRT in half-precision (FP16) mode for less VRAM usage. RTX GPUs also get a speedup.",
        default=False,
        disabled=is_arm_mac or "TensorrtExecutionProvider" not in execution_providers,
    )
)


onnx_category = package.add_category(
    name="ONNX",
    description="Nodes for using the ONNX Neural Network Framework with images.",
    icon="ONNX",
    color="#63B3ED",
    install_hint=inst_hint,
)


logger.debug(f"Loaded package {package.name}")
