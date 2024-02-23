from __future__ import annotations

import os
from pathlib import Path

from sanic.log import logger

from api import Iterator, IteratorOutputInfo
from nodes.impl.onnx.model import OnnxModel
from nodes.properties.inputs import BoolInput, DirectoryInput
from nodes.properties.outputs import (
    DirectoryOutput,
    NumberOutput,
    OnnxModelOutput,
    TextOutput,
)
from nodes.utils.utils import list_all_files_sorted

from .. import batch_processing_group
from ..io.load_model import load_model_node


@batch_processing_group.register(
    schema_id="chainner:onnx:load_models",
    name="加载模型",
    description=(
        "迭代目录中的所有文件，并仅对 ONNX 模型文件 (.onnx) 运行提供的节点。支持与"
        " `chainner:onnx:load_model` 相同的模型。"
    ),
    icon="MdLoop",
    inputs=[
        DirectoryInput(),
        BoolInput("出现错误即停止", default=False).with_docs(
            "不是收集错误并在处理结束时抛出它们，而是在出现错误时立即停止迭代并抛出错误。",
            hint=True,
        ),
    ],
    outputs=[
        OnnxModelOutput(),
        DirectoryOutput("目录", output_type="Input0"),
        TextOutput("子目录路径"),
        TextOutput("名称"),
        NumberOutput("索引", output_type="uint").with_docs(
            "从 0 开始的计数器，每个模型递增 1。"
        ),
    ],
    iterator_outputs=IteratorOutputInfo(outputs=[0, 2, 3, 4]),
    kind="newIterator",
)
def load_models_node(
    directory: Path,
    fail_fast: bool,
) -> tuple[Iterator[tuple[OnnxModel, str, str, int]], Path]:
    logger.debug(f"在目录中迭代模型: {directory}")

    def load_model(path: Path, index: int):
        model, dirname, basename = load_model_node(path)
        # 获取相对于迭代器目录输入传递的根目录的相对路径
        rel_path = os.path.relpath(dirname, directory)
        return model, rel_path, basename, index

    supported_filetypes = [".onnx"]
    model_files = list_all_files_sorted(directory, supported_filetypes)

    return Iterator.from_list(model_files, load_model, fail_fast), directory
