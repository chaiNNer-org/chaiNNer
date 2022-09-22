from __future__ import annotations

import os

import numpy as np
from process import IteratorContext
from sanic.log import logger

from .categories import ImageCategory
from .image_nodes import ImReadNode
from .node_base import IteratorNodeBase, NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.image_utils import get_available_image_formats, normalize
from .utils.utils import get_h_w_c, numerical_sort

IMAGE_ITERATOR_NODE_ID = "chainner:image:file_iterator_load"

VIDEO_ITERATOR_INPUT_NODE_ID = "chainner:image:simple_video_frame_iterator_load"
VIDEO_ITERATOR_OUTPUT_NODE_ID = "chainner:image:simple_video_frame_iterator_save"

SPRITESHEET_ITERATOR_INPUT_NODE_ID = "chainner:image:spritesheet_iterator_load"
SPRITESHEET_ITERATOR_OUTPUT_NODE_ID = "chainner:image:spritesheet_iterator_save"


@NodeFactory.register(IMAGE_ITERATOR_NODE_ID)
class ImageFileIteratorLoadImageNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput().make_optional()]
        self.outputs = [
            ImageOutput(broadcast_type=True),
            DirectoryOutput("Image Directory"),
            TextOutput("Relative Path"),
            TextOutput("Image Name"),
            NumberOutput("Overall Index"),
        ]

        self.category = ImageCategory
        self.name = "Load Image (Iterator)"
        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

        self.side_effects = True

    def run(
        self, path: str, root_dir: str, index: int
    ) -> Tuple[np.ndarray, str, str, str, int]:
        img, img_dir, basename = ImReadNode().run(path)

        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(img_dir, root_dir)

        return img, root_dir, rel_path, basename, index


@NodeFactory.register("chainner:image:file_iterator")
class ImageFileIteratorNode(IteratorNodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Iterate over all files in a directory and run the provided nodes on just the image files."
        self.inputs = [
            DirectoryInput(),
        ]
        self.outputs = []
        self.category = ImageCategory
        self.name = "Image File Iterator"
        self.default_nodes = [
            # TODO: Figure out a better way to do this
            {
                "schemaId": IMAGE_ITERATOR_NODE_ID,
            },
        ]

    # pylint: disable=invalid-overridden-method
    async def run(self, directory: str, context: IteratorContext) -> None:
        logger.info(f"Iterating over images in directory: {directory}")

        img_path_node_id = context.get_helper(IMAGE_ITERATOR_NODE_ID).id

        supported_filetypes = get_available_image_formats()

        def walk_error_handler(exception_instance):
            logger.warning(
                f"Exception occurred during walk: {exception_instance} Continuing..."
            )

        just_image_files: List[str] = []
        for root, dirs, files in os.walk(
            directory, topdown=True, onerror=walk_error_handler
        ):
            await context.progress.suspend()

            dirs.sort(key=numerical_sort)
            for name in sorted(files, key=numerical_sort):
                filepath = os.path.join(root, name)
                _base, ext = os.path.splitext(filepath)
                if ext.lower() in supported_filetypes:
                    just_image_files.append(filepath)

        def before(filepath: str, index: int):
            context.inputs.set_values(img_path_node_id, [filepath, directory, index])

        await context.run(just_image_files, before)


@NodeFactory.register(VIDEO_ITERATOR_INPUT_NODE_ID)
class VideoFrameIteratorFrameLoaderNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput().make_optional()]
        self.outputs = [
            ImageOutput("Frame Image", broadcast_type=True),
            NumberOutput("Frame Index"),
        ]

        self.category = ImageCategory
        self.name = "Load Frame As Image"
        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

        self.side_effects = True

    def run(self, img: np.ndarray, idx: int) -> Tuple[np.ndarray, int]:
        return normalize(img), idx


@NodeFactory.register(VIDEO_ITERATOR_OUTPUT_NODE_ID)
class VideoFrameIteratorFrameWriterNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [
            ImageInput("Frame"),
            DirectoryInput("Output Video Directory"),
            TextInput("Output Video Name"),
            VideoTypeDropdown(),
        ]
        self.outputs = []

        self.category = ImageCategory
        self.name = "Write Output Frame"
        self.icon = "MdVideoCameraBack"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

        self.side_effects = True

    def run(
        self,
        img: np.ndarray,
        save_dir: str,
        video_name: str,
        video_type: str,
        writer,
        fps: float,
    ) -> None:
        if video_type == "none":
            return

        h, w, _ = get_h_w_c(img)

        if writer["out"] is None:
            mp4_codec = "avc1"
            avi_codec = "divx"
            codec = mp4_codec if video_type == "mp4" else avi_codec
            try:
                logger.info(f"Trying to open writer with codec: {codec}")
                fourcc = cv2.VideoWriter_fourcc(*codec)
                video_save_path = os.path.join(save_dir, f"{video_name}.{video_type}")
                logger.info(f"Writing new video to path: {video_save_path}")
                writer["out"] = cv2.VideoWriter(
                    filename=video_save_path,
                    fourcc=fourcc,
                    fps=fps,
                    frameSize=(w, h),
                )
                logger.info(writer["out"])
            except Exception as e:
                logger.warning(
                    f"Failed to open video writer with codec: {codec} because: {e}"
                )

        writer["out"].write((img * 255).astype(np.uint8))


@NodeFactory.register("chainner:image:video_frame_iterator")
class SimpleVideoFrameIteratorNode(IteratorNodeBase):
    def __init__(self):
        super().__init__()
        self.description = (
            "Iterate over all frames in a video, and write to a video buffer."
        )
        self.inputs = [
            VideoFileInput(),
        ]
        self.outputs = []
        self.default_nodes = [
            # TODO: Figure out a better way to do this
            {
                "schemaId": VIDEO_ITERATOR_INPUT_NODE_ID,
            },
            {
                "schemaId": VIDEO_ITERATOR_OUTPUT_NODE_ID,
            },
        ]

        self.category = ImageCategory
        self.name = "Video Frame Iterator"
        self.icon = "MdVideoCameraBack"

    # pylint: disable=invalid-overridden-method
    async def run(self, path: str, context: IteratorContext) -> None:
        logger.info(f"Iterating over frames in video file: {path}")

        input_node_id = context.get_helper(VIDEO_ITERATOR_INPUT_NODE_ID).id
        output_node_id = context.get_helper(VIDEO_ITERATOR_OUTPUT_NODE_ID).id

        # TODO: Open Video Buffer
        cap = cv2.VideoCapture(path)
        writer = {"out": None}

        try:
            fps = float(cap.get(cv2.CAP_PROP_FPS))
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            context.inputs.set_append_values(output_node_id, [writer, fps])

            def before(_: int, index: int):
                ret, frame = cap.read()
                # if frame is read correctly ret is True
                if not ret:
                    print("Can't receive frame (stream end?). Exiting ...")
                    return False

                context.inputs.set_values(input_node_id, [frame, index])

            await context.run(range(frame_count), before)
        finally:
            cap.release()
            if writer["out"] is not None:
                writer["out"].release()


@NodeFactory.register(SPRITESHEET_ITERATOR_INPUT_NODE_ID)
class ImageSpriteSheetIteratorLoadImageNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput().make_optional()]
        self.outputs = [ImageOutput(broadcast_type=True), NumberOutput("Overall Index")]

        self.category = ImageCategory
        self.name = "Load Image (Iterator)"
        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

        self.side_effects = True

    def run(self, img: np.ndarray, index: int) -> Tuple[np.ndarray, int]:
        return img, index


@NodeFactory.register(SPRITESHEET_ITERATOR_OUTPUT_NODE_ID)
class ImageSpriteSheetIteratorAppendImageNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [ImageInput()]
        self.outputs = []

        self.category = ImageCategory
        self.name = "Append Image"
        self.icon = "CgExtensionAdd"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

        self.side_effects = True

    def run(self, img: np.ndarray, results: List[np.ndarray]) -> None:
        results.append(img)


@NodeFactory.register("chainner:image:spritesheet_iterator")
class ImageSpriteSheetIteratorNode(IteratorNodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Iterate over sub-images in a single image spritesheet."
        self.inputs = [
            ImageInput("Spritesheet"),
            NumberInput(
                "Number of rows (vertical)",
                controls_step=1,
                minimum=1,
                default=1,
            ),
            NumberInput(
                "Number of columns (horizontal)",
                controls_step=1,
                minimum=1,
                default=1,
            ),
        ]
        self.outputs = [ImageOutput()]
        self.category = ImageCategory
        self.name = "Spritesheet Iterator"
        self.default_nodes = [
            # TODO: Figure out a better way to do this
            {
                "schemaId": SPRITESHEET_ITERATOR_INPUT_NODE_ID,
            },
            {
                "schemaId": SPRITESHEET_ITERATOR_OUTPUT_NODE_ID,
            },
        ]

    # pylint: disable=invalid-overridden-method
    async def run(
        self,
        sprite_sheet: np.ndarray,
        rows: int,
        columns: int,
        context: IteratorContext,
    ) -> np.ndarray:
        h, w, _ = get_h_w_c(sprite_sheet)
        assert (
            h % rows == 0
        ), "Height of sprite sheet must be a multiple of the number of rows"
        assert (
            w % columns == 0
        ), "Width of sprite sheet must be a multiple of the number of columns"

        img_loader_node_id = context.get_helper(SPRITESHEET_ITERATOR_INPUT_NODE_ID).id
        output_node_id = context.get_helper(SPRITESHEET_ITERATOR_OUTPUT_NODE_ID).id

        individual_h = h // rows
        individual_w = w // columns

        # Split sprite sheet into a single list of images
        img_list: List[np.ndarray] = []

        for row in range(rows):
            for col in range(columns):
                img_list.append(
                    sprite_sheet[
                        row * individual_h : (row + 1) * individual_h,
                        col * individual_w : (col + 1) * individual_w,
                    ]
                )

        results = []
        context.inputs.set_append_values(output_node_id, [results])

        def before(img: np.ndarray, index: int):
            context.inputs.set_values(img_loader_node_id, [img, index])

        await context.run(img_list, before)

        result_rows = []
        for i in range(rows):
            row = np.concatenate(results[i * columns : (i + 1) * columns], axis=1)
            result_rows.append(row)
        return np.concatenate(result_rows, axis=0)
