from __future__ import annotations

import os
from pathlib import Path

import onnx
from sanic.log import logger

from nodes.impl.onnx.model import OnnxModel, load_onnx_model
from nodes.properties.inputs import OnnxFileInput
from nodes.properties.outputs import DirectoryOutput, FileNameOutput, OnnxModelOutput
from nodes.utils.utils import split_file_path

from .. import io_group


@io_group.register(
    schema_id="chainner:onnx:load_model",
    name="加载模型",
    description=(
        "加载 ONNX 模型文件（.onnx）。理论上支持任何不需要非标准预处理的 ONNX 超分辨率模型。"
        "也支持 RemBG 背景去除模型。"
    ),
    icon="ONNX",
    inputs=[OnnxFileInput(primary_input=True)],
    outputs=[
        OnnxModelOutput(),
        DirectoryOutput("目录", of_input=0).with_id(2),
        FileNameOutput("名称", of_input=0).with_id(1),
    ],
    see_also=[
        "chainner:onnx:load_models",
    ],
)
def load_model_node(path: Path) -> tuple[OnnxModel, Path, str]:
    assert os.path.exists(path), f"模型文件在路径 {path} 不存在"

    assert os.path.isfile(path), f"路径 {path} 不是文件"

    logger.debug(f"从路径 {path} 读取 ONNX 模型")
    model = onnx.load_model(str(path))

    model_as_string = model.SerializeToString()

    dirname, basename, _ = split_file_path(path)
    return load_onnx_model(model_as_string), dirname, basename
