from __future__ import annotations

import os
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from subprocess import Popen
from typing import Any, Literal

import ffmpeg
import numpy as np
from sanic.log import logger

from api import Collector, IteratorInputInfo, KeyInfo, NodeContext
from nodes.groups import Condition, if_enum_group, if_group
from nodes.impl.ffmpeg import FFMpegEnv
from nodes.impl.image_utils import to_uint8
from nodes.properties.inputs import (
    BoolInput,
    DirectoryInput,
    EnumInput,
    ImageInput,
    RelativePathInput,
    SliderInput,
    TextInput,
)
from nodes.properties.inputs.generic_inputs import AudioStreamInput
from nodes.properties.inputs.numeric_inputs import NumberInput
from nodes.utils.utils import get_h_w_c

from .. import video_frames_group


class VideoFormat(Enum):
    MKV = "mkv"
    MP4 = "mp4"
    MOV = "mov"
    WEBM = "webm"
    AVI = "avi"
    GIF = "gif"

    @property
    def ext(self) -> str:
        return self.value

    @property
    def encoders(self) -> tuple[VideoEncoder, ...]:
        if self == VideoFormat.MKV:
            return (
                VideoEncoder.H264,
                VideoEncoder.H265,
                VideoEncoder.VP9,
                VideoEncoder.FFV1,
            )
        elif self == VideoFormat.MP4:
            return VideoEncoder.H264, VideoEncoder.H265, VideoEncoder.VP9
        elif self == VideoFormat.MOV:
            return VideoEncoder.H264, VideoEncoder.H265
        elif self == VideoFormat.WEBM:
            return (VideoEncoder.VP9,)
        elif self == VideoFormat.AVI:
            return (VideoEncoder.H264,)
        elif self == VideoFormat.GIF:
            return ()
        else:
            raise ValueError(f"Unknown container: {self}")


class VideoEncoder(Enum):
    H264 = "libx264"
    H265 = "libx265"
    VP9 = "libvpx-vp9"
    FFV1 = "ffv1"

    @property
    def formats(self) -> tuple[VideoFormat, ...]:
        formats: list[VideoFormat] = []
        for format in VideoFormat:
            if self in format.encoders:
                formats.append(format)
        return tuple(formats)


class VideoPreset(Enum):
    ULTRA_FAST = "ultrafast"
    SUPER_FAST = "superfast"
    VERY_FAST = "veryfast"
    FAST = "fast"
    MEDIUM = "medium"
    SLOW = "slow"
    SLOWER = "slower"
    VERY_SLOW = "veryslow"


class AudioSettings(Enum):
    AUTO = "auto"
    COPY = "copy"
    TRANSCODE = "transcode"


class Simplicity(Enum):
    SIMPLE = 0
    ADVANCED = 1


class SimpleVideoFormat(Enum):
    MP4_H264 = "mp4_h264"
    MP4_H265 = "mp4_h265"
    WEBM = "webm"
    GIF = "gif"


PARAMETERS: dict[VideoEncoder, list[Literal["preset", "crf"]]] = {
    VideoEncoder.H264: ["preset", "crf"],
    VideoEncoder.H265: ["preset", "crf"],
    VideoEncoder.VP9: ["crf"],
    VideoEncoder.FFV1: [],
}


@dataclass
class Writer:
    container: VideoFormat
    encoder: VideoEncoder | None
    fps: float
    audio: object | None
    audio_settings: AudioSettings
    save_path: str
    output_params: dict[str, str | float]
    global_params: list[str]
    ffmpeg_env: FFMpegEnv
    out: Popen | None = None

    def start(self, width: int, height: int):
        # Create the writer and run process
        if self.out is None:
            # Verify some parameters
            if self.encoder in (VideoEncoder.H264, VideoEncoder.H265):
                assert (
                    height % 2 == 0 and width % 2 == 0
                ), f'The "{self.encoder.value}" encoder requires an even-number frame resolution.'

            try:
                self.out = (
                    ffmpeg.input(
                        "pipe:",
                        format="rawvideo",
                        pix_fmt="bgr24",
                        s=f"{width}x{height}",
                        r=self.fps,
                        loglevel="error",
                    )
                    .output(**self.output_params, loglevel="error")
                    .overwrite_output()
                    .global_args(*self.global_params)
                    .run_async(
                        pipe_stdin=True, pipe_stdout=False, cmd=self.ffmpeg_env.ffmpeg
                    )
                )

            except Exception as e:
                logger.warning("Failed to open video writer", exc_info=e)

    def write_frame(self, img: np.ndarray):
        # Create the writer and run process
        if self.out is None:
            h, w, _ = get_h_w_c(img)
            self.start(w, h)

        out_frame = to_uint8(img, normalized=True)
        if self.out is not None and self.out.stdin is not None:
            self.out.stdin.write(out_frame.tobytes())
        else:
            raise RuntimeError("Failed to open video writer")

    def close(self):
        if self.out is not None:
            if self.out.stdin is not None:
                self.out.stdin.close()
            self.out.wait()

        if self.audio is not None:
            video_path = self.save_path
            base, ext = os.path.splitext(video_path)
            audio_video_path = f"{base}_av{ext}"

            # Default and auto -> copy
            output_params = {
                "vcodec": "copy",
                "acodec": "copy",
            }
            if self.container == VideoFormat.WEBM:
                if self.audio_settings in (AudioSettings.TRANSCODE, AudioSettings.AUTO):
                    output_params["acodec"] = "libopus"
                    output_params["b:a"] = "320k"
                else:
                    raise ValueError(f"WebM does not support {self.audio_settings}")
            elif self.audio_settings == AudioSettings.TRANSCODE:
                output_params["acodec"] = "aac"
                output_params["b:a"] = "320k"

            try:
                video_stream = ffmpeg.input(video_path)
                output_video = ffmpeg.output(
                    self.audio,
                    video_stream,
                    audio_video_path,
                    **output_params,
                ).overwrite_output()
                ffmpeg.run(output_video)
                # delete original, rename new
                os.remove(video_path)
                os.rename(audio_video_path, video_path)
            except Exception:
                logger.warning(
                    "Failed to copy audio to video, input file probably contains "
                    "no audio or audio stream is supported by this container. Ignoring audio settings."
                )
                try:
                    os.remove(audio_video_path)
                except Exception:
                    pass


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
        DirectoryInput(must_exist=False),
        RelativePathInput("Video Name"),
        EnumInput(
            Simplicity, default=Simplicity.SIMPLE, preferred_style="tabs"
        ).with_id(16),
        if_enum_group(16, Simplicity.ADVANCED)(
            EnumInput(
                VideoFormat,
                label="Video Format",
                option_labels={
                    VideoFormat.MKV: "mkv",
                    VideoFormat.MP4: "mp4",
                    VideoFormat.MOV: "mov",
                    VideoFormat.WEBM: "WebM",
                    VideoFormat.AVI: "avi",
                    VideoFormat.GIF: "GIF",
                },
            ).with_id(4),
            EnumInput(
                VideoEncoder,
                label="Encoder",
                option_labels={
                    VideoEncoder.H264: "H.264 (AVC)",
                    VideoEncoder.H265: "H.265 (HEVC)",
                    VideoEncoder.VP9: "VP9",
                    VideoEncoder.FFV1: "FFV1",
                },
                conditions={
                    VideoEncoder.H264: Condition.enum(4, VideoEncoder.H264.formats),
                    VideoEncoder.H265: Condition.enum(4, VideoEncoder.H265.formats),
                    VideoEncoder.VP9: Condition.enum(4, VideoEncoder.VP9.formats),
                    VideoEncoder.FFV1: Condition.enum(4, VideoEncoder.FFV1.formats),
                },
            )
            .with_id(3)
            .wrap_with_conditional_group(),
            if_enum_group(3, (VideoEncoder.H264, VideoEncoder.H265))(
                EnumInput(VideoPreset, default=VideoPreset.MEDIUM)
                .with_docs(
                    "For more information on presets, see [here](https://trac.ffmpeg.org/wiki/Encode/H.264#Preset)."
                )
                .with_id(8),
            ),
            if_enum_group(3, (VideoEncoder.H264, VideoEncoder.H265, VideoEncoder.VP9))(
                SliderInput(
                    "CRF",
                    min=0,
                    max=51,
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
                    label_style="hidden",
                    allow_empty_string=True,
                    has_handle=False,
                )
                .make_optional()
                .with_id(13)
            ),
        ),
        if_enum_group(16, Simplicity.SIMPLE)(
            EnumInput(
                SimpleVideoFormat,
                label="Video Format",
                option_labels={
                    SimpleVideoFormat.MP4_H264: "MP4 (H.264)",
                    SimpleVideoFormat.MP4_H265: "MP4 (H.265)",
                    SimpleVideoFormat.WEBM: "WebM",
                    SimpleVideoFormat.GIF: "GIF",
                },
            ).with_id(17),
            SliderInput("Quality", min=0, max=100, default=75).with_id(18),
        ),
        NumberInput("FPS", default=30, min=1, step=1, precision=4).with_id(14),
        if_group(~Condition.enum(4, VideoFormat.GIF))(
            AudioStreamInput().make_optional().with_id(15).suggest(),
            if_group(Condition.type(15, "AudioStream"))(
                EnumInput(
                    AudioSettings,
                    label="Audio",
                    default=AudioSettings.AUTO,
                    conditions={
                        AudioSettings.COPY: ~Condition.enum(4, VideoFormat.WEBM)
                    },
                )
                .with_docs(
                    "The first audio stream can be discarded, copied or transcoded at 320 kb/s."
                    " Some audio formats are not supported by selected container, thus copying the audio may fail."
                    " Some players may not output the audio stream if its format is not supported."
                    " If it isn't working for you, verify compatibility or use FFMPEG to mux the audio externally."
                )
                .with_id(10)
            ),
        ),
    ],
    iterator_inputs=IteratorInputInfo(inputs=0),
    outputs=[],
    key_info=KeyInfo.enum(4),
    kind="collector",
    side_effects=True,
    node_context=True,
)
def save_video_node(
    node_context: NodeContext,
    _: None,
    save_dir: Path,
    video_name: str,
    simplicity: Simplicity,
    container: VideoFormat,
    encoder: VideoEncoder,
    video_preset: VideoPreset,
    crf: int,
    advanced: bool,
    additional_parameters: str | None,
    simple_video_format: SimpleVideoFormat,
    quality: int,
    fps: float,
    audio: Any,
    audio_settings: AudioSettings,
) -> Collector[np.ndarray, None]:
    if simplicity == Simplicity.SIMPLE:
        container = {
            SimpleVideoFormat.MP4_H264: VideoFormat.MP4,
            SimpleVideoFormat.MP4_H265: VideoFormat.MP4,
            SimpleVideoFormat.WEBM: VideoFormat.WEBM,
            SimpleVideoFormat.GIF: VideoFormat.GIF,
        }[simple_video_format]

        encoder = {
            SimpleVideoFormat.MP4_H264: VideoEncoder.H264,
            SimpleVideoFormat.MP4_H265: VideoEncoder.H265,
            SimpleVideoFormat.WEBM: VideoEncoder.VP9,
        }[simple_video_format]

        crf = int((100 - quality) / 100 * 51)

        if quality > 95:
            video_preset = VideoPreset.VERY_SLOW
        elif quality > 80:
            video_preset = VideoPreset.SLOWER
        elif quality > 60:
            video_preset = VideoPreset.SLOW
        elif quality >= 50:
            video_preset = VideoPreset.MEDIUM
        elif quality > 35:
            video_preset = VideoPreset.FAST
        elif quality > 20:
            video_preset = VideoPreset.VERY_FAST
        else:
            video_preset = VideoPreset.ULTRA_FAST

    save_path = (save_dir / f"{video_name}.{container.ext}").resolve()
    save_path.parent.mkdir(parents=True, exist_ok=True)

    # Common output settings
    output_params = {
        "filename": str(save_path),
        "pix_fmt": "yuv420p",
        "r": fps,
        "movflags": "faststart",
    }

    # Append parameters
    if encoder in container.encoders:
        output_params["vcodec"] = encoder.value

        parameters = PARAMETERS[encoder]
        if "preset" in parameters:
            output_params["preset"] = video_preset.value
        if "crf" in parameters:
            output_params["crf"] = crf

    # Append additional parameters
    global_params: list[str] = []
    if advanced and additional_parameters is not None:
        additional_parameters = " " + " ".join(additional_parameters.split())
        additional_parameters_array = additional_parameters.split(" -")[1:]
        non_overridable_params = ["filename", "vcodec", "crf", "preset", "c:"]
        for parameter in additional_parameters_array:
            key, value = parameter, None
            try:
                key, value = parameter.split(" ")
            except Exception:
                pass

            if value is not None:
                for nop in non_overridable_params:
                    if not key.startswith(nop):
                        output_params[key] = value
                    else:
                        raise ValueError(f"Duplicate parameter: -{parameter}")
            else:
                global_params.append(f"-{parameter}")

    # Audio
    if container == VideoFormat.GIF:
        audio = None

    writer = Writer(
        container=container,
        encoder=encoder,
        fps=fps,
        audio=audio,
        audio_settings=audio_settings,
        save_path=str(save_path),
        output_params=output_params,
        global_params=global_params,
        ffmpeg_env=FFMpegEnv.get_integrated(node_context.storage_dir),
    )

    def on_iterate(img: np.ndarray):
        writer.write_frame(img)

    def on_complete():
        writer.close()

    return Collector(on_iterate=on_iterate, on_complete=on_complete)
