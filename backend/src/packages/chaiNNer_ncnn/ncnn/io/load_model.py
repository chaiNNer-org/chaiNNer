from __future__ import annotations

from pathlib import Path

from nodes.groups import ncnn_file_inputs_group
from nodes.impl.ncnn.model import NcnnModel, NcnnModelWrapper
from nodes.impl.ncnn.optimizer import NcnnOptimizer
from nodes.properties.inputs import BinFileInput, ParamFileInput
from nodes.properties.outputs import DirectoryOutput, FileNameOutput, NcnnModelOutput
from nodes.utils.utils import split_file_path

from .. import io_group


@io_group.register(
    schema_id="chainner:ncnn:load_model",
    name="加载模型",
    description=(
        "加载 NCNN 模型（.bin 和 .param 文件）。理论上支持任何不需要非标准预处理的 NCNN 超分辨率模型。"
    ),
    icon="NCNN",
    inputs=[
        ncnn_file_inputs_group(
            ParamFileInput(primary_input=True),
            BinFileInput(primary_input=True),
        )
    ],
    outputs=[
        NcnnModelOutput(kind="tagged"),
        DirectoryOutput("目录", of_input=0).with_id(2),
        FileNameOutput("名称", of_input=0).with_id(1),
    ],
    see_also=[
        "chainner:ncnn:load_models",
    ],
)
def load_model_node(
    param_path: Path, bin_path: Path
) -> tuple[NcnnModelWrapper, Path, str]:
    model = NcnnModel.load_from_file(str(param_path), str(bin_path))
    NcnnOptimizer(model).optimize()

    model_dir, model_name, _ = split_file_path(param_path)

    return NcnnModelWrapper(model), model_dir, model_name
