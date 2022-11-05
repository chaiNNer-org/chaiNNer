from __future__ import annotations

import os
from typing import Tuple

import numpy as np
import cv2
from process import IteratorContext
from sanic.log import logger
import ffmpeg

from . import category as ImageCategory
from ...node_base import IteratorNodeBase, NodeBase
from ...node_factory import NodeFactory
from ...properties.inputs import (
    IteratorInput,
    ImageInput,
    DirectoryInput,
    TextInput,
    VideoTypeDropdown,
    VideoFileInput,
    VideoPresetDropdown,
    SliderInput,
)
from ...properties.outputs import ImageOutput, NumberOutput, TextOutput, DirectoryOutput
from ...utils.image_utils import normalize
from ...utils.utils import get_h_w_c

VIDEO_ITERATOR_INPUT_NODE_ID = "chainner:image:simple_video_frame_iterator_load"
VIDEO_ITERATOR_OUTPUT_NODE_ID = "chainner:image:simple_video_frame_iterator_save"

ffmpeg_path = os.environ.get("STATIC_FFMPEG_PATH", "ffmpeg")
ffprobe_path = os.environ.get("STATIC_FFPROBE_PATH", "ffprobe")

codec_map = {
    "mp4": "libx264",
    "avi": "libx264",
    "mkv": "libx264",
    "webm": "libvpx-vp9",
    "gif": "gif",
}


@NodeFactory.register(VIDEO_ITERATOR_INPUT_NODE_ID)
class VideoFrameIteratorFrameLoaderNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [IteratorInput().make_optional()]
        self.outputs = [
            ImageOutput("Frame Image", channels=3, broadcast_type=True),
            NumberOutput("Frame Index"),
            DirectoryOutput("Video Directory"),
            TextOutput("Video Name"),
        ]

        self.category = ImageCategory
        self.name = "Load Frame As Image"
        self.icon = "MdSubdirectoryArrowRight"
        self.sub = "Iteration"

        self.type = "iteratorHelper"

        self.side_effects = True

    def run(
        self, img: np.ndarray, idx: int, video_dir: str, video_name: str
    ) -> Tuple[np.ndarray, int, str, str]:
        return normalize(img), idx, video_dir, video_name


@NodeFactory.register(VIDEO_ITERATOR_OUTPUT_NODE_ID)
class VideoFrameIteratorFrameWriterNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = ""
        self.inputs = [
            ImageInput("Frame"),
            DirectoryInput("Output Video Directory", has_handle=True),
            TextInput("Output Video Name"),
            VideoTypeDropdown(),
            VideoPresetDropdown(),
            SliderInput(
                "Quality (CRF)",
                precision=0,
                controls_step=1,
                slider_step=1,
                minimum=0,
                maximum=51,
                default=23,
                ends=("Best", "Worst"),
            ),
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
        video_preset: str,
        crf: int,
        writer,
        fps: float,
    ) -> None:
        if video_type == "none":
            return

        h, w, _ = get_h_w_c(img)

        if codec_map[video_type] == "libx264":
            assert (
                h % 2 == 0 and w % 2 == 0
            ), f'The codec "libx264" used for video type "{video_type}" requires an even-number frame resolution.'

        if writer["out"] is None:
            try:
                video_save_path = os.path.join(save_dir, f"{video_name}.{video_type}")
                writer["out"] = (
                    ffmpeg.input(
                        "pipe:",
                        format="rawvideo",
                        pix_fmt="rgb24",
                        s=f"{w}x{h}",
                        r=fps,
                    )
                    .output(
                        video_save_path,
                        pix_fmt="yuv420p",
                        r=fps,
                        crf=crf,
                        preset=video_preset if video_preset != "none" else None,
                        vcodec=codec_map[video_type],
                    )
                    .overwrite_output()
                    .run_async(pipe_stdin=True, cmd=ffmpeg_path)
                )
                logger.debug(writer["out"])
            except Exception as e:
                logger.warning(f"Failed to open video writer: {e}")

        out_frame = cv2.cvtColor((img * 255).astype(np.uint8), cv2.COLOR_BGR2RGB)
        if writer["out"] is not None:
            writer["out"].stdin.write(out_frame.tobytes())
        else:
            raise Exception("Failed to open video writer")


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
        logger.debug(f"{ffmpeg_path=}, {ffprobe_path=}")
        logger.debug(f"Iterating over frames in video file: {path}")

        input_node_id = context.get_helper(VIDEO_ITERATOR_INPUT_NODE_ID).id
        output_node_id = context.get_helper(VIDEO_ITERATOR_OUTPUT_NODE_ID).id

        base_name = os.path.basename(path)
        video_dir = os.path.dirname(path)
        video_name = os.path.splitext(base_name)[0]

        ffmpeg_reader = (
            ffmpeg.input(path)
            .output("pipe:", format="rawvideo", pix_fmt="rgb24")
            .run_async(pipe_stdout=True, cmd=ffmpeg_path)
        )

        writer = {"out": None}

        probe = ffmpeg.probe(path, cmd=ffprobe_path)
        video_stream = next(
            (stream for stream in probe["streams"] if stream["codec_type"] == "video"),
            None,
        )

        if video_stream is None:
            raise Exception("No video stream found in file")

        width = video_stream.get("width", None)
        if width is None:
            raise Exception("No width found in video stream")
        width = int(width)
        height = video_stream.get("height", None)
        if height is None:
            raise Exception("No height found in video stream")
        height = int(height)
        fps = video_stream.get("r_frame_rate", None)
        if fps is None:
            raise Exception("No fps found in video stream")
        fps = int(fps.split("/")[0]) / int(fps.split("/")[1])
        frame_count = video_stream.get("nb_frames", None)
        if frame_count is None:
            duration = video_stream.get("duration", None)
            if duration is not None:
                frame_count = float(duration) * fps
            else:
                raise Exception(
                    "No frame count or duration found in video stream. Unable to determine video length. Please report."
                )
        frame_count = int(frame_count)

        context.inputs.set_append_values(output_node_id, [writer, fps])

        def before(index: int):
            in_bytes = ffmpeg_reader.stdout.read(width * height * 3)
            if not in_bytes:
                print("Can't receive frame (stream end?). Exiting ...")
                return False
            in_frame = np.frombuffer(in_bytes, np.uint8).reshape([height, width, 3])
            in_frame = cv2.cvtColor(in_frame, cv2.COLOR_RGB2BGR)

            context.inputs.set_values(
                input_node_id, [in_frame, index, video_dir, video_name]
            )

        await context.run_while(frame_count, before, fail_fast=True)
