from __future__ import annotations

import os
from dataclasses import dataclass
from enum import Enum
from typing import Any, Iterable, List, Literal, Tuple, Union

import av
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
)
from nodes.properties.inputs.generic_inputs import AudioStreamInput
from nodes.properties.inputs.numeric_inputs import NumberInput
from nodes.utils.utils import get_h_w_c

from .. import video_frames_group

AudioData = Union[Tuple[List[Any], str], None]


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


ffmpeg_path = os.environ.get("STATIC_FFMPEG_PATH", "ffmpeg")
ffprobe_path = os.environ.get("STATIC_FFPROBE_PATH", "ffprobe")

PARAMETERS: dict[VideoEncoder, list[Literal["preset", "crf"]]] = {
    VideoEncoder.H264: ["preset", "crf"],
    VideoEncoder.H265: ["preset", "crf"],
    VideoEncoder.VP9: ["crf"],
    VideoEncoder.FFV1: [],
}


@dataclass
class Writer:
    container: VideoFormat
    encoder: VideoEncoder | Literal[VideoFormat.GIF] | None
    fps: float
    audio: tuple[Iterable, Any] | None
    audio_settings: AudioSettings
    save_path: str
    output_params: dict[str, str | float]
    global_params: list[str]
    out: Any | None = None
    out_stream: Any | None = None
    audio_stream: Any | None = None

    def start(self, width: int, height: int):
        # Create the writer and run process
        if self.out is None:
            # Verify some parameters
            if self.encoder in (VideoEncoder.H264, VideoEncoder.H265):
                assert (
                    height % 2 == 0 and width % 2 == 0
                ), f'The "{self.encoder.value}" encoder requires an even-number frame resolution.'

            try:
                string_output_params = {
                    key: str(value) for key, value in self.output_params.items()
                }
                self.out = av.open(
                    self.save_path,
                    mode="w",
                    options=string_output_params,
                    stream_options=self.global_params,
                )
                if self.encoder is not None:
                    logger.info(f"Encoder: {self.encoder.value}")
                    logger.info(f"Container: {self.container.value}")
                    self.out_stream = self.out.add_stream(
                        self.encoder.value, rate=str(self.fps)
                    )
                    self.out_stream.options = string_output_params
                    self.out_stream.crf = self.output_params.get("crf", 23)
                    self.out_stream.preset = self.output_params.get("preset", "medium")
                    self.out_stream.width = width
                    self.out_stream.height = height
                    self.out_stream.pix_fmt = (
                        "rgb8" if self.container == VideoFormat.GIF else "yuv420p"
                    )
                    self.out_stream.thread_type = "AUTO"

            except Exception as e:
                logger.warning("Failed to open video writer", exc_info=e)

    def write_frame(self, img: np.ndarray, audio_data: AudioData):
        # Create the writer and run process
        if self.out is None:
            h, w, _ = get_h_w_c(img)
            self.start(w, h)

        out_frame = av.VideoFrame.from_ndarray(
            to_uint8(img, normalized=True), format="bgr24"
        )
        if self.out is not None and self.out_stream is not None:
            for packet in self.out_stream.encode(out_frame):
                self.out.mux(packet)
        else:
            raise RuntimeError("Failed to open video writer")

        if audio_data is not None and self.container != VideoFormat.GIF:
            audio, codec = audio_data

            audio_codec = None
            audio_rate = None
            if self.container == VideoFormat.WEBM:
                if self.audio_settings in (AudioSettings.TRANSCODE, AudioSettings.AUTO):
                    audio_codec = "libopus"
                    audio_rate = 48000
                else:
                    raise ValueError(f"WebM does not support {self.audio_settings}")
            elif self.audio_settings == AudioSettings.TRANSCODE:
                audio_codec = "aac"
                audio_rate = 320000
            elif self.audio_settings in (AudioSettings.COPY, AudioSettings.AUTO):
                audio_codec = codec or "aac"

            for audio_frame in audio:
                if self.audio_stream is None:
                    self.audio_stream = self.out.add_stream(
                        audio_codec,
                        channels=len(audio_frame.layout.channels),
                        sample_rate=audio_rate or audio_frame.sample_rate,
                    )
                if self.out is not None and self.audio_stream is not None:
                    for packet in self.audio_stream.encode(audio_frame):
                        self.out.mux(packet)
                else:
                    raise RuntimeError("Failed to open audio writer")

    def close(self):
        if self.out is not None:
            if self.out_stream is not None:
                if self.audio:
                    decoded_steam, audio_stream = self.audio
                    self.out.add_stream(template=audio_stream)
                    for frame in decoded_steam:
                        # frame.pts = None
                        for packet in self.out_stream.encode(frame):
                            self.out_stream.mux(packet)

                for packet in self.out_stream.encode():
                    self.out.mux(packet)
            self.out.close()


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
        DirectoryInput("Directory", has_handle=True),
        TextInput("Video Name"),
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
                label_style="hidden",
                allow_empty_string=True,
                has_handle=False,
            )
            .make_optional()
            .with_id(13)
        ),
        NumberInput(
            "FPS", default=30, minimum=1, controls_step=1, has_handle=True, precision=4
        ).with_id(14),
        if_group(~Condition.enum(4, VideoFormat.GIF))(
            AudioStreamInput().make_optional().with_id(15),
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
    iterator_inputs=IteratorInputInfo(inputs=[0, 15]),
    outputs=[],
    kind="collector",
    side_effects=True,
)
def save_video_node(
    _: None,
    save_dir: str,
    video_name: str,
    container: VideoFormat,
    encoder: VideoEncoder,
    video_preset: VideoPreset,
    crf: int,
    advanced: bool,
    additional_parameters: str | None,
    fps: float,
    audio: Any,
    audio_settings: AudioSettings,
) -> Collector[tuple[np.ndarray, AudioData], None]:
    save_path = os.path.join(save_dir, f"{video_name}.{container.ext}")

    # Common output settings
    output_params = {
        "filename": save_path,
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
        encoder=VideoFormat.GIF if container == VideoFormat.GIF else encoder,
        fps=fps,
        audio=audio,
        audio_settings=audio_settings,
        save_path=save_path,
        output_params=output_params,
        global_params=global_params,
    )

    def on_iterate(inputs: tuple[np.ndarray, AudioData]):
        img, audio = inputs
        writer.write_frame(img, audio)

    def on_complete():
        writer.close()

    return Collector(on_iterate=on_iterate, on_complete=on_complete)
