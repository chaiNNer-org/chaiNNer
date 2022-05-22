"""
Nodes that provide functionality for opencv image manipulation
"""

from __future__ import annotations

import os
import platform
import subprocess
import time
from tempfile import mkdtemp

import cv2
import numpy as np
from sanic.log import logger

from .categories import IMAGE
from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.image_utils import get_opencv_formats, get_pil_formats, normalize
from .utils.pil_utils import *
from .utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:load")
class ImReadNode(NodeBase):
    """OpenCV Imread node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Load image from file."
        self.inputs = [ImageFileInput()]
        self.outputs = [
            ImageOutput(),
            DirectoryOutput(),
            TextOutput("Image Name"),
        ]

        self.category = IMAGE
        self.name = "Load Image"
        self.icon = "BsFillImageFill"
        self.sub = "Input & Output"
        self.result = []

    def get_extra_data(self) -> Dict:
        img = self.result[0]
        h, w, c = get_h_w_c(img)

        import base64

        # resize the image, so the preview loads faster and doesn't lag the UI
        # 512 was chosen as the target because a 512x512 RGBA 8bit PNG is at most 1MB in size
        target_size = 512
        max_size = target_size * 1.2
        if w > max_size or h > max_size:
            f = max(w / target_size, h / target_size)
            img = cv2.resize(
                img, (int(w / f), int(h / f)), interpolation=cv2.INTER_AREA
            )

        _, encoded_img = cv2.imencode(".png", (img * 255).astype("uint8"))  # type: ignore
        base64_img = base64.b64encode(encoded_img).decode("utf8")

        return {
            "image": "data:image/png;base64," + base64_img,
            "height": h,
            "width": w,
            "channels": c,
        }

    def run(self, path: str) -> Tuple[np.ndarray, str, str]:
        """Reads an image from the specified path and return it as a numpy array"""

        logger.info(f"Reading image from path: {path}")
        _base, ext = os.path.splitext(path)
        if ext.lower() in get_opencv_formats():
            try:
                img = cv2.imdecode(
                    np.fromfile(path, dtype=np.uint8), cv2.IMREAD_UNCHANGED
                )
            except:
                logger.warning(f"Error loading image, trying with imread.")
                try:
                    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
                except Exception as e:
                    logger.error("Error loading image.")
                    raise RuntimeError(
                        f'Error reading image image from path "{path}". Image may be corrupt.'
                    ) from e
        elif ext.lower() in get_pil_formats():
            try:
                # pylint: disable=redefined-outer-name, import-outside-toplevel
                from PIL import Image

                im = Image.open(path)
                img = np.array(im)
                _, _, c = get_h_w_c(img)
                if c == 3:
                    img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
                elif c == 4:
                    img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGRA)
            except:
                # pylint: disable=raise-missing-from
                raise RuntimeError(
                    f'Error reading image image from path "{path}". Image may be corrupt or Pillow not installed.'
                )
        else:
            raise NotImplementedError(
                "The image you are trying to read cannot be read by chaiNNer."
            )

        # Uncomment if wild 2-channel image is encountered
        # self.shape = img.shape
        # if img.shape[2] == 2:
        #     color_channel = img[:, :, 0]
        #     alpha_channel = img[:, :, 1]
        #     img = np.dstack(color_channel, color_channel, color_channel, alpha_channel)

        img = normalize(img)

        dirname, basename = os.path.split(os.path.splitext(path)[0])
        self.result = (img, dirname, basename)
        return self.result


@NodeFactory.register("chainner:image:save")
class ImWriteNode(NodeBase):
    """OpenCV Imwrite node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Save image to file at a specified directory."
        self.inputs = [
            ImageInput(),
            DirectoryInput(has_handle=True),
            TextInput("Relative Path", optional=True),
            TextInput("Image Name"),
            ImageExtensionDropdown(),
        ]
        self.category = IMAGE
        self.name = "Save Image"
        self.outputs = []
        self.icon = "MdSave"
        self.sub = "Input & Output"

    def run(
        self,
        img: np.ndarray,
        base_directory: str,
        relative_path: str,
        filename: str,
        extension: str,
    ) -> bool:
        """Write an image to the specified path and return write status"""

        full_file = f"{filename}.{extension}"
        if relative_path and relative_path != ".":
            base_directory = os.path.join(base_directory, relative_path)
        full_path = os.path.join(base_directory, full_file)

        logger.info(f"Writing image to path: {full_path}")

        # Put image back in int range
        img = (np.clip(img, 0, 1) * 255).round().astype("uint8")

        os.makedirs(base_directory, exist_ok=True)

        status = cv2.imwrite(full_path, img)

        return status


@NodeFactory.register("chainner:image:preview")
class ImOpenNode(NodeBase):
    """Image Open Node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Open the image in your default image viewer."
        self.inputs = [ImageInput()]
        self.outputs = []
        self.category = IMAGE
        self.name = "Preview Image"
        self.icon = "BsEyeFill"
        self.sub = "Input & Output"

    def run(self, img: np.ndarray):
        """Show image"""

        # Put image back in int range
        img = (np.clip(img, 0, 1) * 255).round().astype("uint8")

        tempdir = mkdtemp(prefix="chaiNNer-")
        logger.info(f"Writing image to temp path: {tempdir}")
        im_name = f"{time.time()}.png"
        temp_save_dir = os.path.join(tempdir, im_name)
        status = cv2.imwrite(
            temp_save_dir,
            img,
        )

        if status:
            if platform.system() == "Darwin":  # macOS
                subprocess.call(("open", temp_save_dir))  # type: ignore
            elif platform.system() == "Windows":  # Windows
                os.startfile(temp_save_dir)  # type: ignore
            else:  # linux variants
                subprocess.call(("xdg-open", temp_save_dir))  # type: ignore
