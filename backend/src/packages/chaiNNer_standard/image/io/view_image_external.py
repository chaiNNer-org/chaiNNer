from __future__ import annotations

import os
import platform
import subprocess
import time
from tempfile import mkdtemp

import cv2
import numpy as np
from sanic.log import logger

from nodes.impl.image_utils import to_uint8
from nodes.properties.inputs import ImageInput

from .. import io_group


@io_group.register(
    schema_id="chainner:image:preview",
    name="查看图像（外部）",
    description=[
        "在默认的图像查看器中打开图像。",
        "这是通过保存一个在 chaiNNer 关闭后将被删除的临时文件来实现的。不建议在进行批处理时使用。",
    ],
    icon="BsEyeFill",
    inputs=[ImageInput("图像")],
    outputs=[],
    side_effects=True,
    limited_to_8bpc="临时文件是一个 8 位 PNG。",
)
def view_image_external_node(img: np.ndarray) -> None:
    tempdir = mkdtemp(prefix="chaiNNer-")
    logger.debug(f"将图像写入临时路径: {tempdir}")
    im_name = f"{time.time()}.png"
    temp_save_dir = os.path.join(tempdir, im_name)
    status = cv2.imwrite(
        temp_save_dir,
        to_uint8(img, normalized=True),
    )

    if status:
        if platform.system() == "Darwin":  # macOS
            subprocess.call(("open", temp_save_dir))
        elif platform.system() == "Windows":  # Windows
            os.startfile(temp_save_dir)  # type: ignore
        else:  # linux variants
            subprocess.call(("xdg-open", temp_save_dir))

