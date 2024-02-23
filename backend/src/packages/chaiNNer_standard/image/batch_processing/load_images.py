from __future__ import annotations

import os
from pathlib import Path

import numpy as np
from wcmatch import glob

from api import Iterator, IteratorOutputInfo
from nodes.groups import Condition, if_group
from nodes.impl.image_formats import get_available_image_formats
from nodes.properties.inputs import BoolInput, DirectoryInput, NumberInput, TextInput
from nodes.properties.outputs import (
    DirectoryOutput,
    ImageOutput,
    NumberOutput,
    TextOutput,
)
from nodes.utils.utils import alphanumeric_sort

from .. import batch_processing_group
from ..io.load_image import load_image_node


def extension_filter(lst: list[str]) -> str:
    """生成 mcmatch.glob 表达式来过滤具有特定扩展名的文件，例如。 {*,**/*}@(*.png|*.jpg|...)"""
    return "**/*@(" + "|".join(lst) + ")"


def list_glob(directory: Path, globexpr: str, ext_filter: list[str]) -> list[Path]:
    extension_expr = extension_filter(ext_filter)

    flags = glob.EXTGLOB | glob.BRACE | glob.GLOBSTAR | glob.NEGATE | glob.DOTGLOB

    foo = list(glob.iglob(globexpr, root_dir=directory, flags=flags))

    filtered = glob.globfilter(
        foo,
        extension_expr,
        flags=flags | glob.IGNORECASE,
    )

    return [
        Path(x)
        for x in sorted(
            {str(directory / f) for f in filtered},
            key=alphanumeric_sort,
        )
    ]


@batch_processing_group.register(
    schema_id="chainner:image:load_images",
    name="加载图像",
    description=[
        "遍历目录/文件夹中的所有文件（批处理）并在仅对图像文件运行提供的节点。支持与 `chainner:image:load` 相同的文件类型。",
        "可选地，您可以切换是否递归迭代（子目录）或使用 glob 表达式来过滤文件。",
    ],
    icon="BsImages",
    inputs=[
        DirectoryInput("目录"),
        BoolInput("使用 WCMatch glob 表达式", default=False),
        if_group(Condition.bool(1, False))(
            BoolInput("递归").with_docs("递归地遍历子目录。")
        ),
        if_group(Condition.bool(1, True))(
            TextInput("WCMatch Glob 表达式", default="**/*").with_docs(
                "有关如何使用 WCMatch glob 表达式的信息，请参阅[此处](https://facelessuser.github.io/wcmatch/glob/)。"
            ),
        ),
        BoolInput("使用限制", default=False),
        if_group(Condition.bool(4, True))(
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
        ImageOutput("图像"),
        DirectoryOutput("目录", output_type="Input0"),
        TextOutput("子目录路径"),
        TextOutput("名称"),
        NumberOutput(
            "索引",
            output_type="if Input4 { min(uint, Input5 - 1) } else { uint }",
        ),
    ],

    iterator_outputs=IteratorOutputInfo(outputs=[0, 2, 3, 4]),
    kind="newIterator",
)
def load_images_node(
    directory: Path,
    use_glob: bool,
    is_recursive: bool,
    glob_str: str,
    use_limit: bool,
    limit: int,
    fail_fast: bool,
) -> tuple[Iterator[tuple[np.ndarray, str, str, int]], Path]:
    def load_image(path: Path, index: int):
        img, img_dir, basename = load_image_node(path)
        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(img_dir, directory)
        return img, rel_path, basename, index

    supported_filetypes = get_available_image_formats()

    if not use_glob:
        glob_str = "**/*" if is_recursive else "*"

    just_image_files = list_glob(directory, glob_str, supported_filetypes)
    if not len(just_image_files):
        raise FileNotFoundError(f"{directory} has no valid images.")

    if use_limit:
        just_image_files = just_image_files[:limit]

    return Iterator.from_list(just_image_files, load_image, fail_fast), directory
