import math
import os

import numpy as np
from process import Executor
from sanic.log import logger

from .image_nodes import ImReadNode
from .node_base import IteratorNodeBase, NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.image_utils import get_available_image_formats

IMAGE_ITERATOR_DEFAULT_NODE_NAME = "Load Image (Iterator)"

VIDEO_ITERATOR_DEFAULT_INPUT_NODE_NAME = "Input Frame"
VIDEO_ITERATOR_DEFAULT_OUTPUT_NODE_NAME = "Output Frame"


@NodeFactory.register("Image", IMAGE_ITERATOR_DEFAULT_NODE_NAME)
class ImageFileIteratorPathNode(NodeBase):
    """Image File Iterator node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput()]
        self.outputs = ImReadNode().get_outputs()
        self.outputs.insert(
            2, TextOutput("Relative Path")
        )  # Add relative path to outputs outside ImReadNode
        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

    def run(self, directory: str = "", root_dir: str = "") -> any:
        imread = ImReadNode()
        imread_output = imread.run(directory)

        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(imread_output[1], root_dir)

        # Set ImRead directory output to root/base directory and insert relative path into outputs
        imread_output[1] = root_dir
        imread_output.insert(2, rel_path)

        return imread_output


@NodeFactory.register("Image", "Image File Iterator")
class ImageFileIteratorNode(IteratorNodeBase):
    """Image File Iterator node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = "Iterate over all files in a directory and run the provided nodes on just the image files."
        self.inputs = [
            DirectoryInput(),
        ]
        self.outputs = []
        self.default_nodes = [
            # TODO: Figure out a better way to do this
            {
                "category": "Image",
                "name": IMAGE_ITERATOR_DEFAULT_NODE_NAME,
            },
        ]

    async def run(
        self,
        directory: str,
        nodes: dict = {},
        external_cache: dict = {},
        loop=None,
        queue=None,
        id="",
        parent_executor=None,
        percent=0,
    ) -> Any:
        logger.info(f"Iterating over images in directory: {directory}")
        logger.info(nodes)

        img_path_node_id = None
        child_nodes = []
        for k, v in nodes.items():
            if (
                v["category"] == "Image"
                and v["node"] == IMAGE_ITERATOR_DEFAULT_NODE_NAME
            ):
                img_path_node_id = v["id"]
            if nodes[k]["child"]:
                child_nodes.append(v["id"])
            # Set this to false to actually allow processing to happen
            nodes[k]["child"] = False

        supported_filetypes = get_available_image_formats()

        def walk_error_handler(exception_instance):
            logger.warning(
                f"Exception occurred during walk: {exception_instance} Continuing..."
            )

        just_image_files = []
        for root, _dirs, files in os.walk(
            directory, topdown=True, onerror=walk_error_handler
        ):
            if parent_executor.should_stop_running():
                return

            for name in files:
                filepath = os.path.join(root, name)
                _base, ext = os.path.splitext(filepath)
                if ext.lower() in supported_filetypes:
                    just_image_files.append(filepath)

        file_len = len(just_image_files)
        start_idx = math.ceil(float(percent) * file_len)
        for idx, filepath in enumerate(just_image_files):
            if parent_executor.should_stop_running():
                return
            if idx >= start_idx:
                await queue.put(
                    {
                        "event": "iterator-progress-update",
                        "data": {
                            "percent": idx / file_len,
                            "iteratorId": id,
                            "running": child_nodes,
                        },
                    }
                )
                # Replace the input filepath with the filepath from the loop
                nodes[img_path_node_id]["inputs"] = [filepath, directory]
                executor = Executor(
                    nodes,
                    loop,
                    queue,
                    external_cache.copy(),
                    parent_executor=parent_executor,
                )
                await executor.run()
                await queue.put(
                    {
                        "event": "iterator-progress-update",
                        "data": {
                            "percent": (idx + 1) / file_len,
                            "iteratorId": id,
                            "running": None,
                        },
                    }
                )
        return ""


@NodeFactory.register("Image", VIDEO_ITERATOR_DEFAULT_INPUT_NODE_NAME)
class VideoFrameIteratorFrameLoaderNode(NodeBase):
    """Video Frame Iterator Frame Loader node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput()]
        self.outputs = [ImageOutput("Frame Image"), TextOutput("Frame Index")]

        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

    def run(self, img: np.ndarray, idx: int) -> any:
        return img, idx


@NodeFactory.register("Image", VIDEO_ITERATOR_DEFAULT_OUTPUT_NODE_NAME)
class VideoFrameIteratorFrameWriterNode(NodeBase):
    """Video Frame Iterator Frame Writer node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = ""
        self.inputs = [ImageInput("Frame")]
        self.outputs = []

        self.icon = "MdVideoCameraBack"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

    def run(self, img: np.ndarray, writer, fourcc, fps, video_save_path) -> any:
        h, w = img.shape[:2]
        if writer["out"] is None:
            writer["out"] = cv2.VideoWriter(
                filename=video_save_path, fourcc=fourcc, fps=fps, frameSize=(w, h)
            )

        writer["out"].write((img * 255).astype(np.uint8))
        return ""


# TODO: Uncomment this when ready to release video frame iterator
# @NodeFactory.register("Image", "Video Frame Iterator")
class SimpleVideoFrameIteratorNode(IteratorNodeBase):
    """Video Frame Iterator node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = (
            "Iterate over all frames in a video, and write to a video buffer."
        )
        self.inputs = [
            VideoFileInput(),
            DirectoryInput("Output Video Directory"),
            TextInput("Output Video Name"),
        ]
        self.outputs = []
        self.default_nodes = [
            # TODO: Figure out a better way to do this
            {
                "category": "Image",
                "name": VIDEO_ITERATOR_DEFAULT_INPUT_NODE_NAME,
            },
            {
                "category": "Image",
                "name": VIDEO_ITERATOR_DEFAULT_OUTPUT_NODE_NAME,
            },
        ]

        self.icon = "MdVideoCameraBack"

    async def run(
        self,
        path: str,
        save_dir: str,
        video_name: str,
        nodes: dict = {},
        external_cache: dict = {},
        loop=None,
        queue=None,
        id="",
        parent_executor=None,
        percent=0,
    ) -> Any:
        logger.info(f"Iterating over frames in video file: {path}")
        logger.info(nodes)

        input_node_id = None
        output_node_id = None
        child_nodes = []
        for k, v in nodes.items():
            if (
                v["category"] == "Image"
                and v["node"] == VIDEO_ITERATOR_DEFAULT_INPUT_NODE_NAME
            ):
                input_node_id = v["id"]
            elif (
                v["category"] == "Image"
                and v["node"] == VIDEO_ITERATOR_DEFAULT_OUTPUT_NODE_NAME
            ):
                output_node_id = v["id"]
            if nodes[k]["child"]:
                child_nodes.append(v["id"])
            # Set this to false to actually allow processing to happen
            nodes[k]["child"] = False

        # TODO: Open Video Buffer
        cap = cv2.VideoCapture(path)
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        video_save_path = os.path.join(save_dir, f"{video_name}.mp4")
        logger.info(f"Writing new video to path: {video_save_path}")
        writer = {"out": None}
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        start_idx = math.ceil(float(percent) * frame_count)
        nodes[output_node_id]["inputs"].extend((writer, fourcc, fps, video_save_path))
        for idx in range(frame_count):
            if parent_executor.should_stop_running():
                cap.release()
                writer["out"].release()
                return
            ret, frame = cap.read()
            # if frame is read correctly ret is True
            if not ret:
                print("Can't receive frame (stream end?). Exiting ...")
                break
            if idx >= start_idx:
                await queue.put(
                    {
                        "event": "iterator-progress-update",
                        "data": {
                            "percent": idx / frame_count,
                            "iteratorId": id,
                            "running": child_nodes,
                        },
                    }
                )
                nodes[input_node_id]["inputs"] = [frame, idx]
                external_cache_copy = external_cache.copy()
                executor = Executor(
                    nodes,
                    loop,
                    queue,
                    external_cache_copy,
                    parent_executor=parent_executor,
                )
                await executor.run()
                del external_cache_copy
                await queue.put(
                    {
                        "event": "iterator-progress-update",
                        "data": {
                            "percent": (idx + 1) / frame_count,
                            "iteratorId": id,
                            "running": None,
                        },
                    }
                )

        cap.release()
        writer["out"].release()
        return ""
