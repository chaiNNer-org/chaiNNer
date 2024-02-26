from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np

from api import Iterator, IteratorOutputInfo
from nodes.groups import Condition, if_group
from nodes.impl.video import VideoLoader
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
            NumberInput("Limit", default=10, minimum=1).with_docs(
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
        NumberOutput("FPS", output_type="0.."),
        AudioStreamOutput(),
    ],
    iterator_outputs=IteratorOutputInfo(outputs=[0, 1]),
    kind="newIterator",
)
def load_video_node(
    path: Path,
    use_limit: bool,
    limit: int,
) -> tuple[Iterator[tuple[np.ndarray, int]], Path, str, float, Any]:
    video_dir, video_name, _ = split_file_path(path)

    loader = VideoLoader(path)
    frame_count = loader.metadata.frame_count
    if use_limit:
        frame_count = min(frame_count, limit)

    audio_stream = loader.get_audio_stream()

    def iterator():
        for index, frame in enumerate(loader.stream_frames()):
            yield frame, index

            if use_limit and index + 1 >= limit:
                break

    return (
        Iterator.from_iter(iter_supplier=iterator, expected_length=frame_count),
        video_dir,
        video_name,
        loader.metadata.fps,
        audio_stream,
    )
