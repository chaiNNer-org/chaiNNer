from __future__ import annotations

import os
from typing import Tuple

import numpy as np
import cv2
from process import IteratorContext
from sanic.log import logger

from ...categories import ImageCategory
from ...node_base import IteratorNodeBase, NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import (
    IteratorInput,
    ImageInput,
    DirectoryInput,
    TextInput,
    VideoTypeDropdown,
    VideoFileInput,
)
from ...properties.outputs import ImageOutput, NumberOutput
from ...utils.image_utils import normalize
from ...utils.utils import get_h_w_c

VIDEO_ITERATOR_INPUT_NODE_ID = "chainner:image:simple_video_frame_iterator_load"
VIDEO_ITERATOR_OUTPUT_NODE_ID = "chainner:image:simple_video_frame_iterator_save"


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
