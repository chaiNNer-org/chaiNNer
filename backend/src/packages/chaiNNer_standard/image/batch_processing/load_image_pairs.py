from __future__ import annotations

import os
from pathlib import Path

import numpy as np

from api import Iterator, IteratorOutputInfo
from nodes.groups import Condition, if_group
from nodes.impl.image_formats import get_available_image_formats
from nodes.properties.inputs import BoolInput, DirectoryInput, NumberInput
from nodes.properties.outputs import (
    DirectoryOutput,
    ImageOutput,
    NumberOutput,
    TextOutput,
)
from nodes.utils.utils import list_all_files_sorted

from .. import batch_processing_group
from ..io.load_image import load_image_node


@batch_processing_group.register(
    schema_id="chainner:image:load_image_pairs",
    name="加载图像对",
    description="遍历两个目录中的所有文件，并同时运行提供的节点处理图像文件对。这对于比较已处理内容的情况可能很有用。",
    icon="BsImages",
    inputs=[
        DirectoryInput("目录 A"),
        DirectoryInput("目录 B"),
        BoolInput("使用限制", default=False),
        if_group(Condition.bool(2, True))(
            NumberInput("限制", default=10, minimum=1).with_docs(
                "限制要遍历的图像数量。这对于在不必遍历所有图像的情况下测试迭代器可能很有用。"
            )
        ),
        BoolInput("遇到错误时停止", default=False).with_docs(
            "而不是在处理结束时收集错误并抛出它们，如果发生错误，则停止迭代并立即抛出错误。",
            hint=True,
        ),
    ],
    outputs=[
        ImageOutput("图像 A"),
        ImageOutput("图像 B"),
        DirectoryOutput("目录 A", output_type="Input0"),
        DirectoryOutput("目录 B", output_type="Input1"),
        TextOutput("子目录路径 A"),
        TextOutput("子目录路径 B"),
        TextOutput("图像名称 A"),
        TextOutput("图像名称 B"),
        NumberOutput(
            "索引",
            output_type="if Input2 { min(uint, Input3 - 1) } else { uint }",
        ).with_docs("一个计数器，从 0 开始，每遍历一个图像递增 1。"),
    ],
    iterator_outputs=IteratorOutputInfo(outputs=[0, 1, 4, 5, 6, 7, 8]),
    kind="newIterator",
)
def load_image_pairs_node(
    directory_a: Path,
    directory_b: Path,
    use_limit: bool,
    limit: int,
    fail_fast: bool,
) -> tuple[
    Iterator[tuple[np.ndarray, np.ndarray, str, str, str, str, int]], Path, Path
]:
    def load_images(filepaths: tuple[Path, Path], index: int):
        path_a, path_b = filepaths
        img_a, img_dir_a, basename_a = load_image_node(path_a)
        img_b, img_dir_b, basename_b = load_image_node(path_b)

        # 从由 Iterator 目录输入传递的根目录获取相对路径
        rel_path_a = os.path.relpath(img_dir_a, directory_a)
        rel_path_b = os.path.relpath(img_dir_b, directory_b)
        return img_a, img_b, rel_path_a, rel_path_b, basename_a, basename_b, index

    supported_filetypes = get_available_image_formats()

    image_files_a: list[Path] = list_all_files_sorted(directory_a, supported_filetypes)
    image_files_b: list[Path] = list_all_files_sorted(directory_b, supported_filetypes)

    assert len(image_files_a) == len(image_files_b), (
        "目录 A 和 B 中的图像数量必须相等。"
        f"目录 A: {directory_a} 中有 {len(image_files_a)} 张图像。"
        f"目录 B: {directory_b} 中有 {len(image_files_b)} 张图像。"
    )

    if use_limit:
        image_files_a = image_files_a[:limit]
        image_files_b = image_files_b[:limit]

    image_files = list(zip(image_files_a, image_files_b))

    return (
        Iterator.from_list(image_files, load_images, fail_fast),
        directory_a,
        directory_b,
    )
