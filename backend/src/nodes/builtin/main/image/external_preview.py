from __future__ import annotations

import os
import platform
import subprocess
import time
from tempfile import mkdtemp

import cv2
import numpy as np
from sanic.log import logger

from ....api.node_base import NodeBase
from ....api.node_factory import NodeFactory
from ....api.inputs import ImageInput


@NodeFactory.register("chainner:image:preview")
class Preview(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Open the image in your default image viewer."
        self.inputs = [ImageInput()]
        self.outputs = []
        self.name = "View Image (external)"
        self.icon = "BsEyeFill"

        self.side_effects = True

    def run(self, img: np.ndarray) -> None:
        """Show image"""

        # Put image back in int range
        img = (np.clip(img, 0, 1) * 255).round().astype("uint8")

        tempdir = mkdtemp(prefix="chaiNNer-")
        logger.debug(f"Writing image to temp path: {tempdir}")
        im_name = f"{time.time()}.png"
        temp_save_dir = os.path.join(tempdir, im_name)
        status = cv2.imwrite(
            temp_save_dir,
            img,
        )

        if status:
            if platform.system() == "Darwin":  # macOS
                subprocess.call(("open", temp_save_dir))
            elif platform.system() == "Windows":  # Windows
                os.startfile(temp_save_dir)  # type: ignore
            else:  # linux variants
                subprocess.call(("xdg-open", temp_save_dir))
