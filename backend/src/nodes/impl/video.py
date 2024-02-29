import os
import subprocess
from dataclasses import dataclass
from io import BufferedIOBase
from pathlib import Path

import ffmpeg
import numpy as np
from sanic.log import logger

FFMPEG_PATH = os.environ.get("STATIC_FFMPEG_PATH", "ffmpeg")
FFPROBE_PATH = os.environ.get("STATIC_FFPROBE_PATH", "ffprobe")


@dataclass(frozen=True)
class VideoMetadata:
    width: int
    height: int
    fps: float
    frame_count: int

    @staticmethod
    def from_file(path: Path):
        probe = ffmpeg.probe(path, cmd=FFPROBE_PATH)
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

        return VideoMetadata(
            width=width,
            height=height,
            fps=fps,
            frame_count=frame_count,
        )


class VideoLoader:
    def __init__(self, path: Path):
        self.path = path
        self.metadata = VideoMetadata.from_file(path)

    def get_audio_stream(self):
        return ffmpeg.input(self.path).audio

    def stream_frames(self):
        """
        Returns an iterator that yields frames as BGR uint8 numpy arrays.
        """

        ffmpeg_reader = (
            ffmpeg.input(self.path)
            .output(
                "pipe:",
                format="rawvideo",
                pix_fmt="bgr24",
                sws_flags="lanczos+accurate_rnd+full_chroma_int+full_chroma_inp+bitexact",
                loglevel="error",
            )
            .run_async(pipe_stdout=True, pipe_stderr=False, cmd=FFMPEG_PATH)
        )
        assert isinstance(ffmpeg_reader, subprocess.Popen)

        with ffmpeg_reader:
            assert isinstance(ffmpeg_reader.stdout, BufferedIOBase)

            width = self.metadata.width
            height = self.metadata.height

            while True:
                in_bytes = ffmpeg_reader.stdout.read(width * height * 3)
                if not in_bytes:
                    logger.debug("Can't receive frame (stream end?). Exiting ...")
                    break

                yield np.frombuffer(in_bytes, np.uint8).reshape([height, width, 3])
