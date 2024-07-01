from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np

import navi
from api import Generator, IteratorOutputInfo, NodeContext, OutputId
from nodes.groups import Condition, if_group
from nodes.impl.ffmpeg import FFMpegEnv
from nodes.impl.video import VideoLoader, VideoMetadata
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


def get_item_types(metadata: VideoMetadata):
    return {
        OutputId(0): navi.Image(
            width=metadata.width, height=metadata.height, channels=3
        ),
    }


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
        BoolInput("Use limit", default=False).with_id(1),
        if_group(Condition.bool(1, True))(
            NumberInput("Limit", default=10, min=1)
            .with_docs(
                "Limit the number of frames to iterate over. This can be useful for testing the iterator without having to iterate over all frames of the video."
                " Will not copy audio if limit is used."
            )
            .with_id(2)
        ),
    ],
    outputs=[
        ImageOutput("Frame", channels=3),
        NumberOutput(
            "Index",
            output_type="min(uint, max(0, IterOutput0.length - 1))",
        ).with_docs("A counter that starts at 0 and increments by 1 for each frame."),
        DirectoryOutput("Video Directory", of_input=0),
        FileNameOutput("Name", of_input=0),
        NumberOutput("FPS", output_type="0.."),
        AudioStreamOutput().suggest(),
    ],
    iterator_outputs=IteratorOutputInfo(
        outputs=[0, 1], length_type="if Input1 { min(uint, Input2) } else { uint }"
    ).with_item_types(VideoMetadata, get_item_types),  # type: ignore
    node_context=True,
    side_effects=True,
    kind="generator",
)
def load_video_node(
    node_context: NodeContext,
    path: Path,
    use_limit: bool,
    limit: int,
) -> tuple[Generator[tuple[np.ndarray, int]], Path, str, float, Any]:
    video_dir, video_name, _ = split_file_path(path)

    loader = VideoLoader(path, FFMpegEnv.get_integrated(node_context.storage_dir))
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
        Generator.from_iter(
            supplier=iterator, expected_length=frame_count
        ).with_metadata(loader.metadata),
        video_dir,
        video_name,
        loader.metadata.fps,
        audio_stream,
    )
