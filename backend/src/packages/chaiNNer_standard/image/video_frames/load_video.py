from __future__ import annotations

import os
from pathlib import Path
from typing import Any

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
    name="加载视频",
    description=[
        "迭代视频中的所有帧作为图像。",
        "使用 FFMPEG 读取视频文件。",
        "此迭代器比直接使用 FFMPEG 要慢得多，因此如果只是进行简单的转换，最好在 chaiNNer 外部直接使用 FFMPEG。",
    ],
    icon="MdVideoCameraBack",
    inputs=[
        VideoFileInput(primary_input=True),
        BoolInput("使用限制", default=False),
        if_group(Condition.bool(1, True))(
            NumberInput("限制", default=10, minimum=1).with_docs(
                "限制要迭代的帧数。这对于在不必迭代视频的所有帧的情况下测试迭代器而不必复制音频非常有用。"
            )
        ),
    ],
    outputs=[
        ImageOutput("帧图像", channels=3),
        NumberOutput(
            "帧索引",
            output_type="if Input1 { min(uint, Input2 - 1) } else { uint }",
        ).with_docs("从0开始递增，为每个帧分配一个索引的计数器。"),
        DirectoryOutput("视频目录", of_input=0),
        FileNameOutput("名称", of_input=0),
        NumberOutput("FPS"),
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

    ffmpeg_reader = (
        ffmpeg.input(path)
        .output(
            "pipe:",
            format="rawvideo",
            pix_fmt="bgr24",
            sws_flags="lanczos+accurate_rnd+full_chroma_int+full_chroma_inp+bitexact",
            loglevel="error",
        )
        .run_async(pipe_stdout=True, cmd=ffmpeg_path)
    )

    probe = ffmpeg.probe(path, cmd=ffprobe_path)
    video_format = probe.get("format", None)
    if video_format is None:
        raise RuntimeError("无法获取视频格式。请报告问题。")
    video_stream = next(
        (stream for stream in probe["streams"] if stream["codec_type"] == "video"),
        None,
    )

    if video_stream is None:
        raise RuntimeError("文件中找不到视频流")

    width = video_stream.get("width", None)
    if width is None:
        raise RuntimeError("在视频流中找不到宽度")
    width = int(width)
    height = video_stream.get("height", None)
    if height is None:
        raise RuntimeError("在视频流中找不到高度")
    height = int(height)
    fps = video_stream.get("r_frame_rate", None)
    if fps is None:
        raise RuntimeError("在视频流中找不到 fps")
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
                "在视频流中找不到帧数或持续时间。无法确定视频长度。请报告问题。"
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
                print("无法接收帧（流结束？）。退出……")
                break
            in_frame = np.frombuffer(in_bytes, np.uint8).reshape([height, width, 3])
            yield in_frame, index
            index += 1

    return (
        Iterator.from_iter(iter_supplier=iterator, expected_length=frame_count),
        video_dir,
        video_name,
        fps,
        audio_stream,
    )
