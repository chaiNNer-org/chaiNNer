from __future__ import annotations

import os
from typing import Any

import cv2
import ffmpeg
import numpy as np

from api import Iterator, IteratorOutputInfo
from nodes.groups import Condition, if_group
from nodes.properties.inputs import BoolInput, NumberInput, VideoFileInput
from nodes.properties.outputs import (
    AudioStreamOutput,
    DirectoryOutput,
    FileNameOutput,
    ImageOutput,
    NumberOutput,
)
from nodes.utils.utils import split_file_path

from .. import video_frames_group

ffmpeg_path = os.environ.get("STATIC_FFMPEG_PATH", "ffmpeg")
ffprobe_path = os.environ.get("STATIC_FFPROBE_PATH", "ffprobe")


@video_frames_group.register(
    schema_id="chainner:image:load_video",
    name="Load Video",
    description=[
        "Iterate over all frames in a video as images.",
        "Uses FFMPEG to read video files.",
        "This iterator is much slower than just using FFMPEG directly, so if you are doing a simple conversion, just use FFMPEG outside chaiNNer instead.",
    ],
    icon="MdVideoCameraBack",
    inputs=[
        VideoFileInput(primary_input=True),
        BoolInput("Use limit", default=False),
        if_group(Condition.bool(1, True))(
            NumberInput("Limit", default=10).with_docs(
                "Limit the number of frames to iterate over. This can be useful for testing the iterator without having to iterate over all frames of the video."
                " Will not copy audio if limit is used."
            )
        ),
    ],
    outputs=[
        ImageOutput("Frame Image", channels=3),
        NumberOutput(
            "Frame Index",
            output_type="if Input1 { min(uint, Input2 - 1) } else { uint }",
        ).with_docs("A counter that starts at 0 and increments by 1 for each frame."),
        DirectoryOutput("Video Directory", of_input=0),
        FileNameOutput("Name", of_input=0),
        NumberOutput("FPS"),
        AudioStreamOutput(),
    ],
    iterator_outputs=IteratorOutputInfo(outputs=[0, 1]),
    kind="newIterator",
)
def load_video_node(
    path: str,
    use_limit: bool,
    limit: int,
) -> tuple[Iterator[tuple[np.ndarray, int]], str, str, float, Any]:
    video_dir, video_name, _ = split_file_path(path)

    ffmpeg_reader = (
        ffmpeg.input(path)
        .output("pipe:", format="rawvideo", pix_fmt="rgb24")
        .run_async(pipe_stdout=True, cmd=ffmpeg_path)
    )

    probe = ffmpeg.probe(path, cmd=ffprobe_path)
    video_format = probe.get("format", None)
    if video_format is None:
        raise RuntimeError("Failed to get video format. Please report.")
    video_stream = next(
        (stream for stream in probe["streams"] if stream["codec_type"] == "video"),
        None,
    )

    if video_stream is None:
        raise RuntimeError("No video stream found in file")

    width = video_stream.get("width", None)
    if width is None:
        raise RuntimeError("No width found in video stream")
    width = int(width)
    height = video_stream.get("height", None)
    if height is None:
        raise RuntimeError("No height found in video stream")
    height = int(height)
    fps = video_stream.get("r_frame_rate", None)
    if fps is None:
        raise RuntimeError("No fps found in video stream")
    fps = int(fps.split("/")[0]) / int(fps.split("/")[1])
    frame_count = video_stream.get("nb_frames", None)
    if frame_count is None:
        duration = video_stream.get("duration", None)
        if duration is None:
            duration = video_format.get("duration", None)
        if duration is not None:
            frame_count = float(duration) * fps
        else:
            raise RuntimeError(
                "No frame count or duration found in video stream. Unable to determine video length. Please report."
            )
    frame_count = int(frame_count)
    if use_limit:
        frame_count = min(frame_count, limit)

    audio_stream = ffmpeg.input(path).audio

    def iterator():
        index = 0
        while True:
            if use_limit and index >= limit:
                break
            in_bytes = ffmpeg_reader.stdout.read(width * height * 3)
            if not in_bytes:
                print("Can't receive frame (stream end?). Exiting ...")
                break
            in_frame = np.frombuffer(in_bytes, np.uint8).reshape([height, width, 3])
            in_frame = cv2.cvtColor(in_frame, cv2.COLOR_RGB2BGR)
            yield in_frame, index
            index += 1

    return (
        Iterator.from_iter(iter_supplier=iterator, expected_length=frame_count),
        video_dir,
        video_name,
        fps,
        audio_stream,
    )
