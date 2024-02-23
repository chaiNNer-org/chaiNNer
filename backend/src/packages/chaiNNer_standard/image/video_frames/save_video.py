from __future__ import annotations

import os
from dataclasses import dataclass
from enum import Enum
from subprocess import Popen
from typing import Any, Literal

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
            raise ValueError(f"未知容器: {self}")


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
    encoder: VideoEncoder | None
    fps: float
    audio: object | None
    audio_settings: AudioSettings
    save_path: str
    output_params: dict[str, str | float]
    global_params: list[str]
    out: Popen | None = None

    def start(self, width: int, height: int):
        # 创建写入器并运行进程
        if self.out is None:
            # 验证一些参数
            if self.encoder in (VideoEncoder.H264, VideoEncoder.H265):
                assert (
                    height % 2 == 0 and width % 2 == 0
                ), f'"{self.encoder.value}" 编码器需要偶数帧分辨率。'

            try:
                self.out = (
                    ffmpeg.input(
                        "pipe:",
                        format="rawvideo",
                        pix_fmt="rgb24",
                        s=f"{width}x{height}",
                        r=self.fps,
                    )
                    .output(**self.output_params)
                    .overwrite_output()
                    .global_args(*self.global_params)
                    .run_async(pipe_stdin=True, cmd=ffmpeg_path)
                )

            except Exception as e:
                logger.warning("打开视频写入器失败", exc_info=e)

    def write_frame(self, img: np.ndarray):
        # 创建写入器并运行进程
        if self.out is None:
            h, w, _ = get_h_w_c(img)
            self.start(w, h)

        out_frame = cv2.cvtColor(to_uint8(img, normalized=True), cv2.COLOR_BGR2RGB)
        if self.out is not None and self.out.stdin is not None:
            self.out.stdin.write(out_frame.tobytes())
        else:
            raise RuntimeError("打开视频写入器失败")

    def close(self):
        if self.out is not None:
            if self.out.stdin is not None:
                self.out.stdin.close()
            self.out.wait()

        if self.audio is not None:
            video_path = self.save_path
            base, ext = os.path.splitext(video_path)
            audio_video_path = f"{base}_av{ext}"

            # 默认和自动 -> 复制
            output_params = {
                "vcodec": "copy",
                "acodec": "copy",
            }
            if self.container == VideoFormat.WEBM:
                if self.audio_settings in (AudioSettings.TRANSCODE, AudioSettings.AUTO):
                    output_params["acodec"] = "libopus"
                    output_params["b:a"] = "320k"
                else:
                    raise ValueError(f"WebM 不支持 {self.audio_settings}")
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
                # 删除原始文件，重命名新文件
                os.remove(video_path)
                os.rename(audio_video_path, video_path)
            except Exception:
                logger.warning(
                    "复制音频到视频失败，输入文件可能不包含音频或音频流不受此容器支持。忽略音频设置。"
                )
                try:
                    os.remove(audio_video_path)
                except Exception:
                    pass


@video_frames_group.register(
    schema_id="chainner:image:save_video",
    name="保存视频",
    description=[
        "将可迭代序列合并成视频，并将其保存到文件。",
        "使用 FFMPEG 编写视频文件。",
        "此迭代器比直接使用 FFMPEG 要慢得多，因此如果只是进行简单的转换，最好在 chaiNNer 外部直接使用 FFMPEG。",
    ],
    icon="MdVideoCameraBack",
    inputs=[
        ImageInput("图像序列", channels=3),
        DirectoryInput("目录", has_handle=True),
        TextInput("视频名称"),
        EnumInput(
            VideoFormat,
            label="视频格式",
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
            label="编码器",
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
                "有关预设的更多信息，请参见[此处](https://trac.ffmpeg.org/wiki/Encode/H.264#Preset)。"
            )
            .with_id(8),
        ),
        if_enum_group(3, (VideoEncoder.H264, VideoEncoder.H265, VideoEncoder.VP9))(
            SliderInput(
                "质量 (CRF)",
                precision=0,
                controls_step=1,
                slider_step=1,
                minimum=0,
                maximum=51,
                default=23,
                ends=("最佳", "最差"),
            )
            .with_docs(
                "有关 CRF 的更多信息，请参见[此处](https://trac.ffmpeg.org/wiki/Encode/H.264#crf)。"
            )
            .with_id(9),
        ),
        BoolInput("附加参数", default=False)
        .with_docs(
            "允许用户添加 FFmpeg 参数。[FFmpeg 文档链接](https://ffmpeg.org/documentation.html)。"
        )
        .with_id(12),
        if_group(Condition.bool(12, True))(
            TextInput(
                "附加参数",
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
                    label="音频",
                    default=AudioSettings.AUTO,
                    conditions={
                        AudioSettings.COPY: ~Condition.enum(4, VideoFormat.WEBM)
                    },
                )
                .with_docs(
                    "第一个音频流可以丢弃、复制或以 320 kb/s 转码。"
                    " 一些音频格式不受所选容器的支持，因此复制音频可能会失败。"
                    " 如果播放器不支持音频流的格式，则某些播放器可能不会输出音频流。"
                    " 如果对您不起作用，请验证兼容性或使用 FFMPEG 在外部混音音频。"
                )
                .with_id(10)
            ),
        ),
    ],
    iterator_inputs=IteratorInputInfo(inputs=0),
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
) -> Collector[np.ndarray, None]:
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
                        raise ValueError(f"重复参数: -{parameter}")
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
        save_path=save_path,
        output_params=output_params,
        global_params=global_params,
    )

    def on_iterate(img: np.ndarray):
        writer.write_frame(img)

    def on_complete():
        writer.close()

    return Collector(on_iterate=on_iterate, on_complete=on_complete)
