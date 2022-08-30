from __future__ import annotations

import math
import os

import numpy as np
from process import ExecutionContext
from sanic.log import logger

from .categories import ImageCategory
from .image_nodes import ImReadNode
from .node_base import IteratorNodeBase, NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.image_utils import get_available_image_formats, normalize
from .utils.utils import get_h_w_c

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
            TextOutput("Overall Index"),
        ]

        self.category = ImageCategory
        self.name = "Load Image (Iterator)"
        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

        self.side_effects = True

    def run(
        self, path: str, root_dir: str, index: int
    ) -> Tuple[np.ndarray, str, str, str, str]:
        img, img_dir, basename = ImReadNode().run(path)

        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(img_dir, root_dir)

        return img, root_dir, rel_path, basename, str(index)


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
    async def run(self, directory: str, context: ExecutionContext) -> None:
        logger.info(f"Iterating over images in directory: {directory}")
        logger.info(context.nodes)

        img_path_node_id = None
        child_nodes: List[str] = []
        for k, v in context.nodes.items():
            if v["schemaId"] == IMAGE_ITERATOR_NODE_ID:
                img_path_node_id = v["id"]
            if context.nodes[k]["child"]:
                child_nodes.append(v["id"])
            # Set this to false to actually allow processing to happen
            context.nodes[k]["child"] = False
        assert img_path_node_id is not None, "Unable to find image iterator helper node"

        supported_filetypes = get_available_image_formats()

        def walk_error_handler(exception_instance):
            logger.warning(
                f"Exception occurred during walk: {exception_instance} Continuing..."
            )

        just_image_files: List[str] = []
        for root, _dirs, files in os.walk(
            directory, topdown=True, onerror=walk_error_handler
        ):
            if context.executor.should_stop_running():
                return

            for name in sorted(files):
                filepath = os.path.join(root, name)
                _base, ext = os.path.splitext(filepath)
                if ext.lower() in supported_filetypes:
                    just_image_files.append(filepath)

        file_len = len(just_image_files)
        start_idx = math.ceil(float(context.percent) * file_len)
        for idx, filepath in enumerate(just_image_files):
            if context.executor.should_stop_running():
                return
            if idx >= start_idx:
                await context.queue.put(
                    {
                        "event": "iterator-progress-update",
                        "data": {
                            "percent": idx / file_len,
                            "iteratorId": context.iterator_id,
                            "running": child_nodes,
                        },
                    }
                )
                # Replace the input filepath with the filepath from the loop
                context.nodes[img_path_node_id]["inputs"] = [filepath, directory, idx]
                executor = context.create_iterator_executor()
                await executor.run()
                await context.queue.put(
                    {
                        "event": "iterator-progress-update",
                        "data": {
                            "percent": (idx + 1) / file_len,
                            "iteratorId": context.iterator_id,
                            "running": None,
                        },
                    }
                )


@NodeFactory.register(VIDEO_ITERATOR_INPUT_NODE_ID)
class VideoFrameIteratorFrameLoaderNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput().make_optional()]
        self.outputs = [
            ImageOutput("Frame Image", broadcast_type=True),
            TextOutput("Frame Index"),
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
        fps,
    ) -> None:
        h, w, _ = get_h_w_c(img)
        if writer["out"] is None and video_type != "none":
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
        if video_type != "none":
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
    async def run(self, path: str, context: ExecutionContext) -> None:
        logger.info(f"Iterating over frames in video file: {path}")
        logger.info(context.nodes)

        input_node_id = None
        output_node_id = None
        child_nodes: List[str] = []
        for k, v in context.nodes.items():
            if v["schemaId"] == VIDEO_ITERATOR_INPUT_NODE_ID:
                input_node_id = v["id"]
            elif v["schemaId"] == VIDEO_ITERATOR_OUTPUT_NODE_ID:
                output_node_id = v["id"]
            if context.nodes[k]["child"]:
                child_nodes.append(v["id"])
            # Set this to false to actually allow processing to happen
            context.nodes[k]["child"] = False
        assert input_node_id is not None, "Unable to find video frame load helper node"
        assert output_node_id is not None, "Unable to find video frame save helper node"

        # TODO: Open Video Buffer
        cap = cv2.VideoCapture(path)
        fps = int(cap.get(cv2.CAP_PROP_FPS))

        writer = {"out": None}
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        start_idx = math.ceil(float(context.percent) * frame_count)
        context.nodes[output_node_id]["inputs"].extend((writer, fps))
        for idx in range(frame_count):
            if context.executor.should_stop_running():
                cap.release()
                if writer["out"] is not None:
                    writer["out"].release()
                return
            ret, frame = cap.read()
            # if frame is read correctly ret is True
            if not ret:
                print("Can't receive frame (stream end?). Exiting ...")
                break
            if idx >= start_idx:
                await context.queue.put(
                    {
                        "event": "iterator-progress-update",
                        "data": {
                            "percent": idx / frame_count,
                            "iteratorId": context.iterator_id,
                            "running": child_nodes,
                        },
                    }
                )
                context.nodes[input_node_id]["inputs"] = [frame, idx]
                executor = context.create_iterator_executor()
                await executor.run()
                await context.queue.put(
                    {
                        "event": "iterator-progress-update",
                        "data": {
                            "percent": (idx + 1) / frame_count,
                            "iteratorId": context.iterator_id,
                            "running": None,
                        },
                    }
                )

        cap.release()
        if writer["out"] is not None:
            writer["out"].release()


@NodeFactory.register(SPRITESHEET_ITERATOR_INPUT_NODE_ID)
class ImageSpriteSheetIteratorLoadImageNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput().make_optional()]
        self.outputs = [ImageOutput(broadcast_type=True), TextOutput("Overall Index")]

        self.category = ImageCategory
        self.name = "Load Image (Iterator)"
        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

        self.side_effects = True

    def run(self, img: np.ndarray, index: int) -> Tuple[np.ndarray, str]:
        return img, str(index)


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
        context: ExecutionContext,
    ) -> np.ndarray:
        h, w, _ = get_h_w_c(sprite_sheet)
        assert (
            h % rows == 0
        ), "Height of sprite sheet must be a multiple of the number of rows"
        assert (
            w % columns == 0
        ), "Width of sprite sheet must be a multiple of the number of columns"

        img_loader_node_id = None
        output_node_id = None
        child_nodes: List[str] = []
        for k, v in context.nodes.items():
            if v["schemaId"] == SPRITESHEET_ITERATOR_INPUT_NODE_ID:
                img_loader_node_id = v["id"]
            elif v["schemaId"] == SPRITESHEET_ITERATOR_OUTPUT_NODE_ID:
                output_node_id = v["id"]
            if context.nodes[k]["child"]:
                child_nodes.append(v["id"])
            # Set this to false to actually allow processing to happen
            context.nodes[k]["child"] = False
        assert (
            img_loader_node_id is not None
        ), "Unable to find sprite sheet load helper node"
        assert (
            output_node_id is not None
        ), "Unable to find sprite sheet append helper node"

        individual_h = h // rows
        individual_w = w // columns

        # Split sprite sheet into a single list of images
        img_list = []

        for row in range(rows):
            for col in range(columns):
                img_list.append(
                    sprite_sheet[
                        row * individual_h : (row + 1) * individual_h,
                        col * individual_w : (col + 1) * individual_w,
                    ]
                )

        length = len(img_list)

        results = []
        context.nodes[output_node_id]["inputs"].append(results)
        for idx, img in enumerate(img_list):
            if context.executor.should_stop_running():
                break
            await context.queue.put(
                {
                    "event": "iterator-progress-update",
                    "data": {
                        "percent": idx / length,
                        "iteratorId": context.iterator_id,
                        "running": child_nodes,
                    },
                }
            )
            # Replace the input filepath with the filepath from the loop
            context.nodes[img_loader_node_id]["inputs"] = [img, idx]
            # logger.info(nodes[output_node_id]["inputs"])
            executor = context.create_iterator_executor()
            await executor.run()
            await context.queue.put(
                {
                    "event": "iterator-progress-update",
                    "data": {
                        "percent": (idx + 1) / length,
                        "iteratorId": context.iterator_id,
                        "running": None,
                    },
                }
            )
        result_rows = []
        for i in range(rows):
            row = np.concatenate(results[i * columns : (i + 1) * columns], axis=1)
            result_rows.append(row)
        return np.concatenate(result_rows, axis=0)
