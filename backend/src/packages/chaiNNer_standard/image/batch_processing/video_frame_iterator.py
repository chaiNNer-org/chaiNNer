from __future__ import annotations

import os
from dataclasses import dataclass
from subprocess import Popen
from typing import Tuple

import cv2
import ffmpeg
import numpy as np
from sanic.log import logger

from nodes.impl.image_utils import to_uint8
from nodes.properties.inputs import (
    BoolInput,
    DirectoryInput,
    ImageInput,
    IteratorInput,
    SliderInput,
    TextInput,
    VideoFileInput,
    VideoPresetDropdown,
    VideoTypeDropdown,
)
from nodes.properties.outputs import (
    DirectoryOutput,
    ImageOutput,
    NumberOutput,
    TextOutput,
)
from nodes.utils.utils import get_h_w_c, split_file_path
from process import IteratorContext

from .. import batch_processing_group

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


@dataclass
class Writer:
    out: Popen | None = None
    copy_audio: bool = False
    video_save_path: str | None = None


@batch_processing_group.register(
    schema_id=VIDEO_ITERATOR_INPUT_NODE_ID,
    name="Load Frame As Image",
    description="",
    icon="MdSubdirectoryArrowRight",
    node_type="iteratorHelper",
    inputs=[IteratorInput().make_optional()],
    outputs=[
        ImageOutput("Frame Image", channels=3),
        NumberOutput("Frame Index"),
        DirectoryOutput("Video Directory"),
        TextOutput("Video Name"),
    ],
    side_effects=True,
)
def VideoFrameIteratorFrameLoaderNode(
    img: np.ndarray, idx: int, video_dir: str, video_name: str
) -> Tuple[np.ndarray, int, str, str]:
    return img, idx, video_dir, video_name


@batch_processing_group.register(
    schema_id=VIDEO_ITERATOR_OUTPUT_NODE_ID,
    name="Write Output Frame",
    description="",
    icon="MdVideoCameraBack",
    node_type="iteratorHelper",
    inputs=[
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
        BoolInput("Copy Audio", default=True),
    ],
    outputs=[],
    side_effects=True,
)
def VideoFrameIteratorFrameWriterNode(
    img: np.ndarray,
    save_dir: str,
    video_name: str,
    video_type: str,
    video_preset: str,
    crf: int,
    copy_audio: bool,
    writer: Writer,
    fps: float,
) -> None:
    if video_type == "none":
        return

    h, w, _ = get_h_w_c(img)

    if codec_map[video_type] == "libx264":
        assert (
            h % 2 == 0 and w % 2 == 0
        ), f'The codec "libx264" used for video type "{video_type}" requires an even-number frame resolution.'

    if writer.out is None:
        try:
            video_save_path = os.path.join(save_dir, f"{video_name}.{video_type}")
            writer.out = (
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
                    movflags="faststart",
                )
                .overwrite_output()
                .run_async(pipe_stdin=True, cmd=ffmpeg_path)
            )
            writer.copy_audio = copy_audio
            writer.video_save_path = video_save_path
            logger.debug(writer.out)
        except Exception as e:
            logger.warning(f"Failed to open video writer: {e}")

    out_frame = cv2.cvtColor(to_uint8(img, normalized=True), cv2.COLOR_BGR2RGB)
    if writer.out is not None and writer.out.stdin is not None:
        writer.out.stdin.write(out_frame.tobytes())
    else:
        raise RuntimeError("Failed to open video writer")


@batch_processing_group.register(
    schema_id="chainner:image:video_frame_iterator",
    name="Video Frame Iterator",
    description="Iterate over all frames in a video, and write to a video buffer.",
    icon="MdVideoCameraBack",
    node_type="iterator",
    inputs=[
        VideoFileInput(primary_input=True),
    ],
    outputs=[],
    default_nodes=[
        # TODO: Figure out a better way to do this
        {
            "schemaId": VIDEO_ITERATOR_INPUT_NODE_ID,
        },
        {
            "schemaId": VIDEO_ITERATOR_OUTPUT_NODE_ID,
        },
    ],
    side_effects=True,
)
async def SimpleVideoFrameIteratorNode(path: str, context: IteratorContext) -> None:
    logger.debug(f"{ffmpeg_path=}, {ffprobe_path=}")
    logger.debug(f"Iterating over frames in video file: {path}")

    input_node_id = context.get_helper(VIDEO_ITERATOR_INPUT_NODE_ID).id
    output_node_id = context.get_helper(VIDEO_ITERATOR_OUTPUT_NODE_ID).id

    video_dir, video_name, _ = split_file_path(path)

    ffmpeg_reader = (
        ffmpeg.input(path)
        .output("pipe:", format="rawvideo", pix_fmt="rgb24")
        .run_async(pipe_stdout=True, cmd=ffmpeg_path)
    )

    writer = Writer()

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

    ffmpeg_reader.stdout.close()
    ffmpeg_reader.wait()
    if writer.out is not None:
        if writer.out.stdin is not None:
            writer.out.stdin.close()
        writer.out.wait()

    if writer.copy_audio and writer.video_save_path is not None:
        out_path = writer.video_save_path
        base, ext = os.path.splitext(out_path)
        if "gif" not in ext.lower():
            full_out_path = f"{base}_audio{ext}"
            audio_stream = ffmpeg.input(path).audio
            try:
                if audio_stream is not None:
                    video_stream = ffmpeg.input(out_path)
                    output_video = ffmpeg.output(
                        audio_stream,
                        video_stream,
                        full_out_path,
                        vcodec="copy",
                    ).overwrite_output()
                    ffmpeg.run(output_video)
                    # delete original, rename new
                    os.remove(out_path)
                    os.rename(full_out_path, out_path)
            except:
                logger.warning(
                    f"Failed to copy audio to video, input file probably contains no audio. Ignoring audio copy."
                )
