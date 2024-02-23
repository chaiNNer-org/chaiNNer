from __future__ import annotations

import os
from pathlib import Path

from sanic.log import logger
from spandrel import ModelDescriptor

from api import Iterator, IteratorOutputInfo, NodeContext
from nodes.properties.inputs import DirectoryInput
from nodes.properties.inputs.generic_inputs import BoolInput
from nodes.properties.outputs import DirectoryOutput, NumberOutput, TextOutput
from nodes.properties.outputs.pytorch_outputs import ModelOutput
from nodes.utils.utils import list_all_files_sorted

from .. import batch_processing_group
from ..io.load_model import load_model_node


@batch_processing_group.register(
    schema_id="chainner:pytorch:load_models",
    name="加载模型",
    description=(
        "迭代遍历目录中的所有文件，并仅对 PyTorch 模型文件 (.pth) 运行提供的节点。支持与 `chainner:pytorch:load_model` 相同的模型。"
    ),
    icon="MdLoop",
    inputs=[
        DirectoryInput(),
        BoolInput("Stop on first error", default=False).with_docs(
            "在处理过程中，不是收集错误并在处理结束时抛出，而是在出现错误时立即停止迭代并抛出错误。",
            hint=True,
        ),
    ],
    outputs=[
        ModelOutput(),
        DirectoryOutput("Directory", output_type="Input0"),
        TextOutput("Subdirectory Path"),
        TextOutput("Name"),
        NumberOutput("Index", output_type="uint").with_docs(
            "从 0 开始递增的计数器，每个模型递增 1。"
        ),
    ],
    iterator_outputs=IteratorOutputInfo(outputs=[0, 2, 3, 4]),
    kind="newIterator",
    node_context=True,
)
def load_models_node(
    context: NodeContext,
    directory: Path,
    fail_fast: bool,
) -> tuple[Iterator[tuple[ModelDescriptor, str, str, int]], Path]:
    logger.debug(f"迭代目录中的模型: {directory}")

    def load_model(path: Path, index: int):
        model, dirname, basename = load_model_node(context, path)
        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(dirname, directory)
        return model, rel_path, basename, index

    supported_filetypes = [".pt", ".pth", ".ckpt", ".safetensors"]
    model_files: list[Path] = list_all_files_sorted(directory, supported_filetypes)

    return Iterator.from_list(model_files, load_model, fail_fast), directory
