from __future__ import annotations

import os
from dataclasses import dataclass
from enum import Enum
from subprocess import Popen
from typing import Any, Optional

import cv2
import ffmpeg
import numpy as np
from sanic.log import logger

from api import Collector, IteratorInputInfo
from nodes.groups import Condition, if_enum_group, if_group
from nodes.impl.image_utils import to_uint8
from nodes.properties.inputs import (
    BoolInput,
    DirectoryInput,
    EnumInput,
    ImageInput,
    SliderInput,
    TextInput,
    VideoContainer,
    VideoEncoder,
    VideoEncoderDropdown,
    VideoFfv1ContainerDropdown,
    VideoH264ContainerDropdown,
    VideoH265ContainerDropdown,
    VideoPresetDropdown,
    VideoVp9ContainerDropdown,
)
from nodes.properties.inputs.generic_inputs import AudioStreamInput
from nodes.properties.inputs.numeric_inputs import NumberInput
from nodes.utils.utils import get_h_w_c

from .. import video_frames_group

ffmpeg_path = os.environ.get("STATIC_FFMPEG_PATH", "ffmpeg")
ffprobe_path = os.environ.get("STATIC_FFPROBE_PATH", "ffprobe")

PARAMETERS: dict[VideoEncoder, list] = {
    VideoEncoder.H264: ["preset", "crf"],
    VideoEncoder.H265: ["preset", "crf"],
    VideoEncoder.VP9: ["crf"],
    VideoEncoder.FFV1: [],
}


class AudioSettings(Enum):
    AUTO = "auto"
    COPY = "copy"
    TRANSCODE = "transcode"


class AudioReducedSettings(Enum):
    AUTO = AudioSettings.AUTO.value
    TRANSCODE = AudioSettings.TRANSCODE.value


AUDIO_SETTINGS_DOC = """The first audio stream can be discarded, copied or transcoded at 320 kb/s.
Some audio formats are not supported by selected container, thus copying the audio may fail.
Some players may not output the audio stream if its format is not supported.
If it isn't working for you, verify compatibility or use FFMPEG to mux the audio externally."""


@dataclass
class Writer:
    out: Popen | None = None
    video_save_path: str | None = None
    container: VideoContainer = VideoContainer.MP4
    video_encoder: VideoEncoder = VideoEncoder.H264
    audio_settings: AudioSettings = AudioSettings.AUTO


@video_frames_group.register(
    schema_id="chainner:image:save_video",
    name="Save Video",
    description=[
        "Combines an iterable sequence into a video, which it saves to a file.",
        "Uses FFMPEG to write video files.",
        "This iterator is much slower than just using FFMPEG directly, so if you are doing a simple conversion, just use FFMPEG outside chaiNNer instead.",
    ],
    icon="MdVideoCameraBack",
    inputs=[
        ImageInput("Image Sequence", channels=3),
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
        if_enum_group(3, (VideoEncoder.H264, VideoEncoder.H265))(
            VideoPresetDropdown()
            .with_docs(
                "For more information on presets, see [here](https://trac.ffmpeg.org/wiki/Encode/H.264#Preset)."
            )
            .with_id(8),
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
            .with_id(9),
        ),
        BoolInput("Additional parameters", default=False)
        .with_docs(
            "Allow user to add FFmpeg parameters. [Link to FFmpeg documentation](https://ffmpeg.org/documentation.html)."
        )
        .with_id(12),
        if_group(Condition.bool(12, True))(
            TextInput(
                "Additional parameters",
                multiline=True,
                hide_label=True,
                allow_empty_string=True,
                has_handle=False,
            )
            .make_optional()
            .with_id(13)
        ),
        NumberInput(
            "FPS", default=30, minimum=1, controls_step=1, has_handle=True, precision=2
        ).with_id(14),
        AudioStreamInput().make_optional().with_id(15),
        if_group(
            (
                ~Condition.enum(7, VideoContainer.WEBM)
                | ~Condition.enum(3, VideoEncoder.VP9)
            )
            & Condition.type(15, "AudioStream")
        )(
            EnumInput(label="Audio", enum=AudioSettings, default=AudioSettings.AUTO)
            .with_docs(AUDIO_SETTINGS_DOC)
            .with_id(10)
        ),
        if_group(
            Condition.enum(7, VideoContainer.WEBM)
            & Condition.enum(3, VideoEncoder.VP9)
            & Condition.type(15, "AudioStream")
        )(
            EnumInput(
                label="Audio",
                enum=AudioReducedSettings,
                default=AudioReducedSettings.AUTO,
            )
            .with_docs(AUDIO_SETTINGS_DOC)
            .with_id(11)
        ),
    ],
    iterator_inputs=IteratorInputInfo(inputs=0),
    outputs=[],
    node_type="collector",
    side_effects=True,
)
def save_video_node(
    _: None,
    save_dir: str,
    video_name: str,
    video_encoder: VideoEncoder,
    h264_container: VideoContainer,
    h265_container: VideoContainer,
    ffv1_container: VideoContainer,
    vp9_container: VideoContainer,
    video_preset: str,
    crf: int,
    advanced: bool,
    additional_parameters: Optional[str],
    fps: float,
    audio: Any,
    audio_settings: AudioSettings,
    audio_reduced_settings: AudioReducedSettings,
) -> Collector[np.ndarray, None,]:
    encoder = VideoEncoder(video_encoder)
    container = None

    # Determine video container
    if encoder == VideoEncoder.H264:
        container = VideoContainer(h264_container)
    elif encoder == VideoEncoder.H265:
        container = VideoContainer(h265_container)
    elif encoder == VideoEncoder.FFV1:
        container = VideoContainer(ffv1_container)
    elif encoder == VideoEncoder.VP9:
        container = VideoContainer(vp9_container)

    if container is None:
        raise ValueError(f"Invalid container: {container}")

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
    output_params["vcodec"] = encoder.value

    parameters = PARAMETERS[encoder]
    if "preset" in parameters:
        output_params["preset"] = video_preset
    if "crf" in parameters:
        output_params["crf"] = crf

    # Append additional parameters
    global_params = list()
    if advanced and additional_parameters is not None:
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
        audio = None
    elif container == VideoContainer.WEBM:
        audio_settings = AudioSettings(audio_reduced_settings)

    writer = Writer()

    def on_iterate(img: np.ndarray):
        # Create the writer and run process
        if writer.out is None:
            h, w, _ = get_h_w_c(img)

            # Verify some parameters
            if encoder in [VideoEncoder.H264, VideoEncoder.H265]:
                assert (
                    h % 2 == 0 and w % 2 == 0
                ), f'The "{encoder.value}" encoder requires an even-number frame resolution.'

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

    def on_complete():
        audio_stream = audio  # It complains if I don't do this
        if writer.out is not None:
            if writer.out.stdin is not None:
                writer.out.stdin.close()
            writer.out.wait()

        if writer.video_save_path is not None and audio_stream is not None:
            video_path = writer.video_save_path
            base, ext = os.path.splitext(video_path)
            audio_video_path = f"{base}_av{ext}"

            # Default and auto -> copy
            output_params = dict(
                vcodec="copy",
                acodec="copy",
            )
            if writer.container == VideoContainer.WEBM:
                if writer.audio_settings in [
                    AudioSettings.TRANSCODE,
                    AudioSettings.AUTO,
                ]:
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
                    f"no audio or audio stream is supported by this container. Ignoring audio settings."
                )
                try:
                    os.remove(audio_video_path)
                except:
                    pass

    return Collector(on_iterate=on_iterate, on_complete=on_complete)
