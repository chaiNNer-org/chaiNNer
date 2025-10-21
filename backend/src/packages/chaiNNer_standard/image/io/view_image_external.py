from __future__ import annotations

import os
import platform
import subprocess
import time
from tempfile import mkdtemp

import cv2
import numpy as np

from logger import get_logger_from_env

logger = get_logger_from_env()

from nodes.impl.image_utils import to_uint8
from nodes.properties.inputs import ImageInput

from .. import io_group


@io_group.register(
    schema_id="chainner:image:preview",
    name="View Image (external)",
    description=[
        "Open the image in your default image viewer.",
        "This works by saving a temporary file that will be deleted after chaiNNer is closed. It is not recommended to be used when performing batch processing.",
    ],
    icon="BsEyeFill",
    inputs=[ImageInput()],
    outputs=[],
    side_effects=True,
    limited_to_8bpc="The temporary file is an 8-bit PNG.",
)
def view_image_external_node(img: np.ndarray) -> None:
    tempdir = mkdtemp(prefix="chaiNNer-")
    logger.debug("Writing image to temp path: %s", tempdir)
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
