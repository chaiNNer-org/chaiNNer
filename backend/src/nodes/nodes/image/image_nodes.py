"""
Nodes that provide functionality for opencv image manipulation
"""

from __future__ import annotations

import os
import platform
import random
import subprocess
import time
from tempfile import mkdtemp
import string

import cv2
import numpy as np
from PIL import Image
from sanic.log import logger

from ...categories import ImageCategory
from ...node_base import NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import *
from ...properties.outputs import *
from ...utils.image_utils import get_opencv_formats, get_pil_formats, normalize
from ...utils.pil_utils import *
from ...utils.utils import get_h_w_c


@NodeFactory.register("chainner:image:load")
class ImReadNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Load image from specified file."
        self.inputs = [ImageFileInput()]
        self.outputs = [
            LargeImageOutput(),
            DirectoryOutput("Image Directory"),
            TextOutput("Image Name"),
        ]

        self.category = ImageCategory
        self.name = "Load Image"
        self.icon = "BsFillImageFill"
        self.sub = "Input & Output"

    def read_cv(self, path: str) -> np.ndarray:
        img = None
        try:
            img = cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_UNCHANGED)
        except Exception as cv_err:
            logger.warning(f"Error loading image, trying with imdecode: {cv_err}")

        if img is None:
            try:
                img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
            except Exception as e:
                raise RuntimeError(
                    f'Error reading image image from path "{path}". Image may be corrupt.'
                ) from e

        if img is None:
            raise RuntimeError(  # pylint: disable=raise-missing-from
                f'Error reading image image from path "{path}". Image may be corrupt.'
            )

        return img

    def read_pil(self, path: str) -> np.ndarray:
        im = Image.open(path)
        img = np.array(im)
        _, _, c = get_h_w_c(img)
        if c == 3:
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        elif c == 4:
            img = cv2.cvtColor(img, cv2.COLOR_RGBA2BGRA)
        return img

    def run(self, path: str) -> Tuple[np.ndarray, str, str]:
        """Reads an image from the specified path and return it as a numpy array"""

        logger.debug(f"Reading image from path: {path}")
        _base, ext = os.path.splitext(path)

        supported_by_cv = ext.lower() in get_opencv_formats()
        supported_by_pil = ext.lower() in get_pil_formats()

        if not supported_by_cv and not supported_by_pil:
            raise NotImplementedError(
                f'The image "{path}" you are trying to read cannot be read by chaiNNer.'
            )

        img = None
        error = None
        if supported_by_cv:
            try:
                img = self.read_cv(path)
            except Exception as e:
                error = e
        if img is None and supported_by_pil:
            try:
                img = self.read_pil(path)
            except Exception as e:
                error = e

        if img is None:
            if error is not None:
                raise error
            raise RuntimeError(f'Internal error loading image "{path}".')

        img = normalize(img)

        dirname, basename = os.path.split(os.path.splitext(path)[0])
        return img, dirname, basename


@NodeFactory.register("chainner:image:save")
class ImWriteNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Save image to file at a specified directory."
        self.inputs = [
            ImageInput(),
            DirectoryInput(has_handle=True),
            TextInput("Subdirectory Path").make_optional(),
            TextInput("Image Name"),
            ImageExtensionDropdown(),
        ]
        self.category = ImageCategory
        self.name = "Save Image"
        self.outputs = []
        self.icon = "MdSave"
        self.sub = "Input & Output"

        self.side_effects = True

    def run(
        self,
        img: np.ndarray,
        base_directory: str,
        relative_path: Union[str, None],
        filename: str,
        extension: str,
    ) -> bool:
        """Write an image to the specified path and return write status"""

        full_file = f"{filename}.{extension}"
        if relative_path and relative_path != ".":
            base_directory = os.path.join(base_directory, relative_path)
        full_path = os.path.join(base_directory, full_file)

        logger.debug(f"Writing image to path: {full_path}")

        # Put image back in int range
        img = (np.clip(img, 0, 1) * 255).round().astype("uint8")

        os.makedirs(base_directory, exist_ok=True)
        # Any image not supported by cv2, will be handled by pillow.
        if extension not in ["png", "jpg", "gif", "tiff", "webp"]:
            status = 1  # spoof
            channels = get_h_w_c(img)[2]
            if channels == 1:
                # PIL supports grayscale images just fine, so we don't need to do any conversion
                pass
            elif channels == 3:
                img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            elif channels == 4:
                img = cv2.cvtColor(img, cv2.COLOR_BGRA2RGBA)
            else:
                raise RuntimeError(
                    f"Unsupported number of channels. Saving .{extension} images is only supported for "
                    f"grayscale, RGB, and RGBA images."
                )
            with Image.fromarray(img) as image:
                image.save(full_path)
        else:
            # Write image with opencv if path is ascii, since imwrite doesn't support unicode
            # This saves us from having to keep the image buffer in memory, if possible
            if full_path.isascii():
                status = cv2.imwrite(full_path, img)
            else:
                try:
                    temp_filename = f'temp-{"".join(random.choices(string.ascii_letters, k=16))}.{extension}'
                    full_temp_path = full_path.replace(full_file, temp_filename)
                    status = cv2.imwrite(full_temp_path, img)
                    os.rename(full_temp_path, full_path)
                except:
                    status, buf_img = cv2.imencode(f".{extension}", img)
                    with open(full_path, "wb") as outf:
                        bytes_written = outf.write(buf_img)
                        status = status and bytes_written == len(buf_img)

        return status


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

    def run(self, img: np.ndarray):
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
                subprocess.call(("open", temp_save_dir))  # type: ignore
            elif platform.system() == "Windows":  # Windows
                os.startfile(temp_save_dir)  # type: ignore
            else:  # linux variants
                subprocess.call(("xdg-open", temp_save_dir))  # type: ignore


@NodeFactory.register("chainner:image:view")
class ImViewNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "See an inline preview of the image in the editor."
        self.inputs = [ImageInput()]
        self.outputs = [
            LargeImageOutput("Preview", image_type="Input0", has_handle=False)
        ]
        self.category = ImageCategory
        self.name = "View Image"
        self.icon = "BsEyeFill"
        self.sub = "Input & Output"

        self.side_effects = True

    def run(self, img: np.ndarray):
        return img
