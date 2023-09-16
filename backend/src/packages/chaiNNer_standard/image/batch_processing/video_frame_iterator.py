from __future__ import annotations

import os
from dataclasses import dataclass
from enum import Enum
from subprocess import Popen
from typing import Tuple

import cv2
import ffmpeg
import numpy as np
from sanic.log import logger

from nodes.groups import Condition, if_enum_group, if_group
from nodes.impl.image_utils import to_uint8
from nodes.properties.inputs import (
    BoolInput,
    DirectoryInput,
    EnumInput,
    ImageInput,
    IteratorInput,
    NumberInput,
    SliderInput,
    TextInput,
    VideoContainer,
    VideoEncoder,
    VideoEncoderDropdown,
    VideoFfv1ContainerDropdown,
    VideoFileInput,
    VideoH264ContainerDropdown,
    VideoH265ContainerDropdown,
    VideoNoneContainerDropdown,
    VideoPresetDropdown,
    VideoVp9ContainerDropdown,
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

PARAMETERS: dict[VideoEncoder, list] = {
    VideoEncoder.H264: ["preset", "crf"],
    VideoEncoder.H265: ["preset", "crf"],
    VideoEncoder.VP9: ["crf"],
    VideoEncoder.FFV1: [],
    VideoEncoder.NONE: [],
}


class AudioSettings(Enum):
    AUTO = "auto"
    COPY = "copy"
    TRANSCODE = "transcode"
    NONE = "none"


class AudioReducedSettings(Enum):
    AUTO = AudioSettings.AUTO.value
    TRANSCODE = AudioSettings.TRANSCODE.value
    NONE = AudioSettings.NONE.value


AUDIO_SETTINGS_DOC = """The first audio stream can be discarded, copied or transcoded at 320 kb/s.
Some audio formats are not supported by selected container, thus copying the audio may fail.
Some players may not output the audio stream if its format is not supported.
If it isn't working for you, verify compatibility or use FFMPEG to mux the audio externally."""


@dataclass
class Writer:
    out: Popen | None = None
    video_save_path: str | None = None
    container: VideoContainer = VideoContainer.NONE
    video_encoder: VideoEncoder = VideoEncoder.NONE
    audio_settings: AudioSettings = AudioSettings.AUTO


@batch_processing_group.register(
    schema_id=VIDEO_ITERATOR_INPUT_NODE_ID,
    name="Load Frame As Image",
    description="",
    icon="MdSubdirectoryArrowRight",
    node_type="iteratorHelper",
    inputs=[IteratorInput().make_optional()],
    outputs=[
        ImageOutput("Frame Image", channels=3),
        NumberOutput("Frame Index", output_type="uint").with_docs(
            "A counter that starts at 0 and increments by 1 for each frame."
        ),
        DirectoryOutput("Video Directory"),
        TextOutput("Video Name"),
    ],
    side_effects=True,
)
def iterator_helper_load_frame_as_image_node(
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
        ImageInput("Frame", channels=3),
        DirectoryInput("Output Video Directory", has_handle=True),
        TextInput("Output Video Name"),
        VideoEncoderDropdown().with_docs("Encoder").with_id(3),
        if_enum_group(3, VideoEncoder.H264)(
            VideoH264ContainerDropdown().with_docs("Container").with_id(4)
        ),
        if_enum_group(3, (VideoEncoder.H265))(
            VideoH265ContainerDropdown().with_docs("Container").with_id(5)
        ),
        if_enum_group(3, VideoEncoder.FFV1)(
            VideoFfv1ContainerDropdown().with_docs("Container").with_id(6)
        ),
        if_enum_group(3, VideoEncoder.VP9)(
            VideoVp9ContainerDropdown().with_docs("Container").with_id(7)
        ),
        if_enum_group(3, VideoEncoder.NONE)(
            VideoNoneContainerDropdown().with_docs("Container").with_id(8)
        ),
        if_enum_group(3, (VideoEncoder.H264, VideoEncoder.H265))(
            VideoPresetDropdown()
            .with_docs(
                "For more information on presets, see [here](https://trac.ffmpeg.org/wiki/Encode/H.264#Preset)."
            )
            .with_id(9),
        ),
        if_enum_group(
            3,
            (VideoEncoder.H264, VideoEncoder.H265, VideoEncoder.VP9),
        )(
            SliderInput(
                "Quality (CRF)",
                precision=0,
                controls_step=1,
                slider_step=1,
                minimum=0,
                maximum=51,
                default=23,
                ends=("Best", "Worst"),
            )
            .with_docs(
                "For more information on CRF, see [here](https://trac.ffmpeg.org/wiki/Encode/H.264#crf)."
            )
            .with_id(10),
        ),
        if_group(~Condition.enum(3, VideoEncoder.NONE))(
            if_group(
                ~Condition.enum(7, VideoContainer.WEBM)
                | ~Condition.enum(3, VideoEncoder.VP9)
            )(
                EnumInput(label="Audio", enum=AudioSettings, default=AudioSettings.AUTO)
                .with_docs(AUDIO_SETTINGS_DOC)
                .with_id(11)
            ),
            if_group(
                Condition.enum(7, VideoContainer.WEBM)
                & Condition.enum(3, VideoEncoder.VP9)
            )(
                EnumInput(
                    label="Audio",
                    enum=AudioReducedSettings,
                    default=AudioReducedSettings.AUTO,
                )
                .with_docs(AUDIO_SETTINGS_DOC)
                .with_id(12)
            ),
            BoolInput("Additional parameters", default=False)
            .with_docs(
                "Allow user to add FFmpeg parameters. [Link to FFmpeg documentation](https://ffmpeg.org/documentation.html)."
            )
            .with_id(13),
            if_group(Condition.bool(13, True))(
                TextInput(
                    "Additional parameters",
                    multiline=True,
                    hide_label=True,
                    allow_empty_string=True,
                    has_handle=False,
                ).make_optional()
            ),
        ),
    ],
    outputs=[],
    side_effects=True,
)
def iterator_helper_write_output_frame_node(
    img: np.ndarray,
    save_dir: str,
    video_name: str,
    video_encoder: str,
    h264_container: str,
    h265_container: str,
    ffv1_container: str,
    vp9_container: str,
    none_container: str,
    video_preset: str,
    crf: int,
    audio_settings: AudioSettings,
    audio_reduced_settings: AudioReducedSettings,
    advanced: bool,
    additional_parameters: str,
    writer: Writer,
    fps: float,
) -> None:
    encoder = VideoEncoder(video_encoder)
    container = VideoContainer(none_container)

    if encoder == VideoEncoder.NONE and container == VideoContainer.NONE:
        # Do not ouptut video
        return

    # Determine video container
    if encoder == VideoEncoder.H264:
        container = VideoContainer(h264_container)
    elif encoder == VideoEncoder.H265:
        container = VideoContainer(h265_container)
    elif encoder == VideoEncoder.FFV1:
        container = VideoContainer(ffv1_container)
    elif encoder == VideoEncoder.VP9:
        container = VideoContainer(vp9_container)

    h, w, _ = get_h_w_c(img)
    extension = container.value
    video_save_path = os.path.join(save_dir, f"{video_name}.{extension}")

    # Common output settings
    output_params = dict(
        filename=video_save_path,
        pix_fmt="yuv420p",
        r=fps,
        movflags="faststart",
    )

    # Append parameters
    if encoder != VideoEncoder.NONE:
        output_params["vcodec"] = encoder.value

    parameters = PARAMETERS[encoder]
    if "preset" in parameters:
        output_params["preset"] = video_preset
    if "crf" in parameters:
        output_params["crf"] = crf

    # Verify some parameters
    if encoder in [VideoEncoder.H264, VideoEncoder.H265]:
        assert (
            h % 2 == 0 and w % 2 == 0
        ), f'The "{encoder.value}" encoder requires an even-number frame resolution.'

    # Append additional parameters
    global_params = list()
    if advanced:
        additional_parameters = " " + " ".join(additional_parameters.split())
        additional_parameters_array = additional_parameters.split(" -")[1:]
        non_overridable_params = ["filename", "vcodec", "crf", "preset", "c:"]
        for parameter in additional_parameters_array:
            key, value = parameter, None
            try:
                key, value = parameter.split(" ")
            except:
                pass

            if value is not None:
                for nop in non_overridable_params:
                    if not key.startswith(nop):
                        output_params[key] = value
                    else:
                        raise ValueError(f"Duplicate parameter: -{parameter}")
            else:
                global_params.append(f"-{parameter}")

    # Modify audio settings if needed
    audio_settings = AudioSettings(audio_settings)
    if container == VideoContainer.GIF:
        audio_settings = AudioSettings.NONE
    elif container == VideoContainer.WEBM:
        audio_settings = AudioSettings(audio_reduced_settings)

    # Create the writer and run process
    if writer.out is None:
        try:
            writer.out = (
                ffmpeg.input(
                    "pipe:",
                    format="rawvideo",
                    pix_fmt="rgb24",
                    s=f"{w}x{h}",
                    r=fps,
                )
                .output(**output_params)
                .overwrite_output()
                .global_args(*global_params)
                .run_async(pipe_stdin=True, cmd=ffmpeg_path)
            )
            writer.video_save_path = video_save_path
            writer.container = container
            writer.video_encoder = encoder
            writer.audio_settings = audio_settings

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
    description=[
        "Iterate over all frames in a video, and write to a video buffer.",
        "Uses FFMPEG to read and write video files.",
        "This iterator is much slower than just using FFMPEG directly, so if you are doing a simple conversion, just use FFMPEG outside chaiNNer instead.",
    ],
    icon="MdVideoCameraBack",
    node_type="iterator",
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
    limited_to_8bpc="The video will be read and written as 8-bit RGB.",
)
async def video_frame_iterator_node(
    path: str, use_limit: bool, limit: int, context: IteratorContext
) -> None:
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

    if use_limit:

        def limit_before(index: int, _unused: int):
            return before(index)

        frame_count = min(frame_count, limit)
        await context.run(range(frame_count), limit_before)
    else:
        await context.run_while(frame_count, before, fail_fast=True)

    ffmpeg_reader.stdout.close()
    ffmpeg_reader.wait()
    if writer.out is not None:
        if writer.out.stdin is not None:
            writer.out.stdin.close()
        writer.out.wait()

    audio_stream = ffmpeg.input(path).audio
    if (
        not use_limit
        and writer.video_save_path is not None
        and audio_stream is not None
        and writer.container != VideoContainer.NONE
        and writer.video_encoder != VideoEncoder.NONE
        and writer.audio_settings != AudioSettings.NONE
    ):
        video_path = writer.video_save_path
        base, ext = os.path.splitext(video_path)
        audio_video_path = f"{base}_av{ext}"

        # Default and auto -> copy
        output_params = dict(
            vcodec="copy",
            acodec="copy",
        )
        if writer.container == VideoContainer.WEBM:
            if writer.audio_settings in [AudioSettings.TRANSCODE, AudioSettings.AUTO]:
                output_params["acodec"] = "libopus"
                output_params["b:a"] = "320k"
            else:
                audio_stream = None
        elif writer.audio_settings == AudioSettings.TRANSCODE:
            output_params["acodec"] = "aac"
            output_params["b:a"] = "320k"

        try:
            video_stream = ffmpeg.input(video_path)
            output_video = ffmpeg.output(
                audio_stream,
                video_stream,
                audio_video_path,
                **output_params,
            ).overwrite_output()
            ffmpeg.run(output_video)
            # delete original, rename new
            os.remove(video_path)
            os.rename(audio_video_path, video_path)
        except:
            logger.warning(
                f"Failed to copy audio to video, input file probably contains "
                f"no audio or ausio stream is supported by this container. Ignoring audio settings."
            )
            try:
                os.remove(audio_video_path)
            except:
                pass
