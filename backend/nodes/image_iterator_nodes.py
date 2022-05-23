from __future__ import annotations
import asyncio
import math
import os
from typing import Any

import numpy as np
from process import Executor
from sanic.log import logger


from .categories import IMAGE
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


@NodeFactory.register(IMAGE_ITERATOR_NODE_ID)
class ImageFileIteratorLoadImageNode(NodeBase):
    """Image File Iterator Load Image node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput()]
        self.outputs = ImReadNode().get_outputs()
        self.outputs.insert(
            2, TextOutput("Relative Path")
        )  # Add relative path to outputs outside ImReadNode

        self.category = IMAGE
        self.name = "Load Image (Iterator)"
        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

    def run(
        self, directory: str = "", root_dir: str = ""
    ) -> Tuple[np.ndarray, str, str, str]:
        imread = ImReadNode()
        imread_output = imread.run(directory)
        img, _, basename = imread_output

        # Get relative path from root directory passed by Iterator directory input
        rel_path = os.path.relpath(imread_output[1], root_dir)

        return img, root_dir, rel_path, basename


@NodeFactory.register("chainner:image:file_iterator")
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
        self.category = IMAGE
        self.name = "Image File Iterator"
        self.default_nodes = [
            # TODO: Figure out a better way to do this
            {
                "schemaId": IMAGE_ITERATOR_NODE_ID,
            },
        ]

    # pylint: disable=invalid-overridden-method
    async def run(
        self,
        directory: str,
        nodes: Union[dict, None] = None,
        external_cache: Union[dict, None] = None,
        loop=None,
        queue: asyncio.Queue = asyncio.Queue(),
        iterator_id="",
        parent_executor=None,
        percent=0,
    ) -> None:
        logger.info(f"Iterating over images in directory: {directory}")
        logger.info(nodes)

        assert nodes is not None, "Nodes must be provided"
        assert external_cache is not None, "External cache must be provided"

        img_path_node_id = None
        child_nodes = []
        for k, v in nodes.items():
            if v["schemaId"] == IMAGE_ITERATOR_NODE_ID:
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
            if parent_executor is not None and parent_executor.should_stop_running():
                return

            for name in files:
                filepath = os.path.join(root, name)
                _base, ext = os.path.splitext(filepath)
                if ext.lower() in supported_filetypes:
                    just_image_files.append(filepath)

        file_len = len(just_image_files)
        start_idx = math.ceil(float(percent) * file_len)
        for idx, filepath in enumerate(just_image_files):
            if parent_executor is not None and parent_executor.should_stop_running():
                return
            if idx >= start_idx:
                await queue.put(
                    {
                        "event": "iterator-progress-update",
                        "data": {
                            "percent": idx / file_len,
                            "iteratorId": iterator_id,
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
                            "iteratorId": iterator_id,
                            "running": None,
                        },
                    }
                )


@NodeFactory.register(VIDEO_ITERATOR_INPUT_NODE_ID)
class VideoFrameIteratorFrameLoaderNode(NodeBase):
    """Video Frame Iterator Frame Loader node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput()]
        self.outputs = [ImageOutput("Frame Image"), TextOutput("Frame Index")]

        self.category = IMAGE
        self.name = "Load Frame As Image"
        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

    def run(self, img: np.ndarray, idx: int) -> Tuple[np.ndarray, int]:
        return normalize(img), idx


@NodeFactory.register(VIDEO_ITERATOR_OUTPUT_NODE_ID)
class VideoFrameIteratorFrameWriterNode(NodeBase):
    """Video Frame Iterator Frame Writer node"""

    def __init__(self):
        """Constructor"""
        super().__init__()
        self.description = ""
        self.inputs = [
            ImageInput("Frame"),
            DirectoryInput("Output Video Directory"),
            TextInput("Output Video Name"),
            VideoTypeDropdown(),
        ]
        self.outputs = []

        self.category = IMAGE
        self.name = "Write Output Frame"
        self.icon = "MdVideoCameraBack"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

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
    """Video Frame Iterator node"""

    def __init__(self):
        """Constructor"""
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

        self.category = IMAGE
        self.name = "Video Frame Iterator"
        self.icon = "MdVideoCameraBack"

    # pylint: disable=invalid-overridden-method
    async def run(
        self,
        path: str,
        nodes: Union[dict, None] = None,
        external_cache: Union[dict, None] = None,
        loop=None,
        queue: asyncio.Queue = asyncio.Queue(),
        iterator_id="",
        parent_executor=None,
        percent=0,
    ) -> None:
        logger.info(f"Iterating over frames in video file: {path}")
        logger.info(nodes)

        assert nodes is not None, "Nodes must be provided"
        assert external_cache is not None, "External cache must be provided"

        input_node_id = None
        output_node_id = None
        child_nodes = []
        for k, v in nodes.items():
            if v["schemaId"] == VIDEO_ITERATOR_INPUT_NODE_ID:
                input_node_id = v["id"]
            elif v["schemaId"] == VIDEO_ITERATOR_OUTPUT_NODE_ID:
                output_node_id = v["id"]
            if nodes[k]["child"]:
                child_nodes.append(v["id"])
            # Set this to false to actually allow processing to happen
            nodes[k]["child"] = False

        # TODO: Open Video Buffer
        cap = cv2.VideoCapture(path)
        fps = int(cap.get(cv2.CAP_PROP_FPS))

        writer = {"out": None}
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        start_idx = math.ceil(float(percent) * frame_count)
        nodes[output_node_id]["inputs"].extend((writer, fps))
        for idx in range(frame_count):
            if parent_executor is not None and parent_executor.should_stop_running():
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
                await queue.put(
                    {
                        "event": "iterator-progress-update",
                        "data": {
                            "percent": idx / frame_count,
                            "iteratorId": iterator_id,
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
                            "iteratorId": iterator_id,
                            "running": None,
                        },
                    }
                )

        cap.release()
        if writer["out"] is not None:
            writer["out"].release()
