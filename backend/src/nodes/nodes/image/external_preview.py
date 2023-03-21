from __future__ import annotations

import os
import platform
import subprocess
import time
from tempfile import mkdtemp

import cv2
import numpy as np
from sanic.log import logger

from ...impl.image_utils import to_uint8
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import ImageInput
from . import category as ImageCategory


@NodeFactory.register("chainner:image:preview")
class ImOpenNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Open the image in your default image viewer."
        self.inputs = [ImageInput()]
        self.outputs = []
        self.category = ImageCategory
        self.name = "View Image (external)"
        self.icon = "BsEyeFill"
        self.sub = "Input & Output"

        self.side_effects = True

    def run(self, img: np.ndarray) -> None:
        """Show image"""

        tempdir = mkdtemp(prefix="chaiNNer-")
        logger.debug(f"Writing image to temp path: {tempdir}")
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
