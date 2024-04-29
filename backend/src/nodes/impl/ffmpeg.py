from __future__ import annotations

import zipfile
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from subprocess import check_call

import requests
from sanic.log import logger

from system import is_arm_mac, is_linux, is_mac, is_windows


def get_download_url() -> str:
    if is_windows:
        return "https://github.com/chaiNNer-org/ffmpeg-rehost/releases/download/ffmpeg/ffmpeg-win32-x64.zip"

    if is_arm_mac:
        return "https://github.com/chaiNNer-org/ffmpeg-rehost/releases/download/ffmpeg/ffmpeg-darwin-arm64.zip"
    if is_mac:
        return "https://github.com/chaiNNer-org/ffmpeg-rehost/releases/download/ffmpeg/ffmpeg-darwin-x64.zip"

    if is_linux:
        return "https://github.com/chaiNNer-org/ffmpeg-rehost/releases/download/ffmpeg/ffmpeg-linux-x64.zip"

    raise Exception("Unsupported platform")


def get_executable_path(base_dir: Path) -> tuple[Path, Path]:
    if is_windows:
        return base_dir / "ffmpeg.exe", base_dir / "ffprobe.exe"

    return base_dir / "ffmpeg", base_dir / "ffprobe"


def setup_integrated_ffmpeg(base_dir: Path):
    url = get_download_url()
    download_path = base_dir / "_ffmpeg.zip"

    logger.info("Downloading FFMPEG...")
    with requests.get(url, stream=True) as r:
        r.raise_for_status()
        base_dir.mkdir(exist_ok=True, parents=True)
        with download_path.open("wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)

    logger.info("Extracting FFMPEG...")
    with zipfile.ZipFile(download_path, "r") as zip_ref:
        # extract and flatten the zip
        for file in zip_ref.filelist:
            zip_ref.extract(file, base_dir)
    download_path.unlink()

    logger.info("Settings permissions for FFMPEG...")
    ffmpeg_path, ffprobe_path = get_executable_path(base_dir)

    if is_mac:
        # Un-Quarantine ffmpeg on macOS
        try:
            check_call(["xattr", "-dr", "com.apple.quarantine", str(ffmpeg_path)])
            check_call(["xattr", "-dr", "com.apple.quarantine", str(ffprobe_path)])
        except Exception as e:
            logger.warn(f"Failed to un-quarantine ffmpeg: {e}")

    if is_arm_mac:
        # M1 can only run signed files, we must ad-hoc sign it
        try:
            check_call(["xattr", "-cr", str(ffmpeg_path)])
            check_call(["xattr", "-cr", str(ffprobe_path)])
            check_call(["codesign", "-s", "-", str(ffmpeg_path)])
            check_call(["codesign", "-s", "-", str(ffprobe_path)])
        except Exception as e:
            logger.warn(f"Failed to sign ffmpeg: {e}")

    if is_mac or is_linux:
        # Make the files executable
        try:
            ffmpeg_path.chmod(0o7777)
            ffprobe_path.chmod(0o7777)
        except Exception as e:
            logger.warn(f"Failed to set permissions for ffmpeg: {e}")


_setup_future: Future[None] | None = None


def run_setup(base_dir: Path):
    # we want to run setup_integrated_ffmpeg in a new thread, and wait for it to finish.
    # we do this so that multiple threads don't try to download and extract the ffmpeg binaries at the same time.

    def task():
        try:
            setup_integrated_ffmpeg(base_dir)
            return
        except Exception as e:
            logger.warn(f"Failed to setup FFMPEG: {e}")
            logger.warn("Trying again...")

        setup_integrated_ffmpeg(base_dir)

    global _setup_future
    if _setup_future is None:
        executor = ThreadPoolExecutor(max_workers=1)
        _setup_future = executor.submit(task)
        executor.shutdown(wait=True)

    _setup_future.result()


@dataclass(frozen=True)
class FFMpegEnv:
    """
    Paths to FFMPEG binaries.
    """

    ffmpeg: str
    ffprobe: str

    @staticmethod
    def from_env() -> FFMpegEnv:
        return FFMpegEnv(
            ffmpeg="ffmpeg",
            ffprobe="ffprobe",
        )

    @staticmethod
    def get_integrated(base_dir: Path) -> FFMpegEnv:
        base_dir = base_dir.resolve() / "ffmpeg"
        ffmpeg_path, ffprobe_path = get_executable_path(base_dir)

        if not ffmpeg_path.exists():
            logger.info(f"Integrated FFMPEG not found at {ffmpeg_path}")
            run_setup(base_dir)

        return FFMpegEnv(
            ffmpeg=str(ffmpeg_path),
            ffprobe=str(ffprobe_path),
        )
