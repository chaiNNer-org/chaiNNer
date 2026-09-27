from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import time
from collections.abc import Iterable
from dataclasses import dataclass
from logging import Logger

from custom_types import UpdateProgressFn

python_path = sys.executable
dir_path = os.path.dirname(os.path.realpath(__file__))

installed_packages: dict[str, str] = {}

COLLECTING_REGEX = re.compile(r"Collecting ([a-zA-Z0-9-_]+)")
UNINSTALLING_REGEX = re.compile(r"Uninstalling ([a-zA-Z0-9-_]+)-+")

DEP_MAX_PROGRESS = 0.8

# Socket timeout in seconds, and how many times pip retries a failed download.
# The pip cache is deliberately left enabled: a dropped connection then only
# costs the one wheel that was in flight instead of the whole install.
NETWORK_TIMEOUT = 60
NETWORK_RETRIES = 10

# How long to wait for a line from pip before sending a keep-alive progress
# update. pip prints nothing at all while unpacking large wheels.
HEARTBEAT_INTERVAL = 5.0

ENV = {
    **os.environ,
    "PYTHONIOENCODING": "utf-8",
    # Disable user site-packages to prevent pip from using global Python packages
    # This ensures packages are installed in chaiNNer's isolated environment
    "PYTHONNOUSERSITE": "1",
}

# Buffer for extraction, temporary files, and overhead (100 MB)
# This is added on top of the actual dependency sizes
DISK_SPACE_BUFFER = 100 * 1024 * 1024


def calculate_required_disk_space(dependencies: list[DependencyInfo]) -> float:
    """
    Calculate the required disk space for installing dependencies.
    Returns the total size in bytes, including a buffer for extraction and overhead.
    """
    total_size = 0.0

    for dep in dependencies:
        if dep.size_estimate is not None:
            # Use the provided size estimate
            total_size += dep.size_estimate
        elif dep.from_file is not None:
            # Check the actual file size for local wheel files
            whl_file = f"{dir_path}/whls/{dep.package_name}/{dep.from_file}"
            if os.path.isfile(whl_file):
                try:
                    total_size += os.path.getsize(whl_file)
                except Exception:
                    # If we can't get the file size, use a conservative estimate
                    total_size += 10 * 1024 * 1024  # 10 MB default
            else:
                # File doesn't exist, use conservative estimate
                total_size += 10 * 1024 * 1024  # 10 MB default
        else:
            # No size information available, use conservative estimate
            total_size += 10 * 1024 * 1024  # 10 MB default

    # Add buffer for extraction, temporary files, and pip overhead
    # Pip often needs 2-3x the package size during installation
    return total_size * 3 + DISK_SPACE_BUFFER


def check_disk_space(path: str | None = None) -> tuple[int, int]:
    """
    Check available disk space at the given path.
    Returns a tuple of (total, free) disk space in bytes.
    """
    if path is None:
        path = dir_path

    try:
        stat = shutil.disk_usage(path)
        return stat.total, stat.free
    except Exception:
        # If we can't check disk space, assume it's available
        # This prevents breaking the installation on systems where disk_usage fails
        return 0, DISK_SPACE_BUFFER + 1


@dataclass(frozen=True)
class DependencyInfo:
    package_name: str
    version: str
    display_name: str | None = None
    from_file: str | None = None
    extra_index_url: str | None = None
    index_url: str | None = None
    extras: str | None = None
    size_estimate: int | float | None = None


def pin(dependency: DependencyInfo) -> str:
    package_name = dependency.package_name

    if dependency.from_file is not None:
        whl_file = f"{dir_path}/whls/{package_name}/{dependency.from_file}"
        if os.path.isfile(whl_file):
            return whl_file

    if dependency.extras:
        package_name = f"{package_name}[{dependency.extras}]"

    return f"{package_name}=={dependency.version}"


def build_index_args(dependencies: Iterable[DependencyInfo]) -> list[str]:
    """
    Builds the pip index arguments for a set of dependencies.

    An index_url replaces PyPI entirely and wins over extra_index_url, because
    that is the only way to stop pip from silently resolving a package (e.g.
    torch) to the PyPI build instead of the vendor one.
    """
    args: list[str] = []

    index_urls = {d.index_url for d in dependencies if d.index_url}
    if len(index_urls) > 1:
        raise ValueError("Cannot install from more than one index_url at once.")
    for url in index_urls:
        args.extend(["--index-url", url])

    for url in sorted({d.extra_index_url for d in dependencies if d.extra_index_url}):
        args.extend(["--extra-index-url", url])

    if index_urls:
        # PyPI is no longer the main index, so it has to be added back for
        # everything that is not published by the vendor.
        args.extend(["--extra-index-url", "https://pypi.org/simple"])

    return args


SEMVER_REGEX = re.compile(r"(\d+)(?:\.(\d+)(?:\.(\d+))?)?")


def coerce_semver(version: str) -> tuple[int, int, int]:
    match = re.search(SEMVER_REGEX, version)
    if match:
        return (
            int(match.group(1) or 0),
            int(match.group(2) or 0),
            int(match.group(3) or 0),
        )
    return (0, 0, 0)


def filter_necessary_to_install(dependencies: Iterable[DependencyInfo]):
    """
    Filters out dependencies that are already installed and have the same or higher version.
    """
    dependencies_to_install: list[DependencyInfo] = []
    for dependency in dependencies:
        version = installed_packages.get(dependency.package_name, None)
        if version:
            # A local version label (e.g. +rocm10.0.0 or +cu128) is not part of
            # the semver comparison, so "2.12.0+cpu" and "2.12.0+rocm10.0.0"
            # would look identical. Compare the full string in that case.
            if "+" in dependency.version and version != dependency.version:
                dependencies_to_install.append(dependency)
                continue

            installed_version = coerce_semver(version)
            dep_version = coerce_semver(dependency.version)
            if installed_version < dep_version:
                dependencies_to_install.append(dependency)
        elif not version:
            dependencies_to_install.append(dependency)
    return dependencies_to_install


def install_dependencies_sync(
    dependencies: list[DependencyInfo],
):
    dependencies_to_install = filter_necessary_to_install(dependencies)
    if len(dependencies_to_install) == 0:
        return 0

    # Check available disk space before installing
    _total_space, free_space = check_disk_space()
    required_space = calculate_required_disk_space(dependencies_to_install)

    if free_space < required_space:
        free_mb = free_space / (1024 * 1024)
        required_mb = required_space / (1024 * 1024)
        raise OSError(
            f"Insufficient disk space. Available: {free_mb:.1f} MB, Required: {required_mb:.1f} MB. "
            "Please free up disk space and try again."
        )

    extra_index_args = build_index_args(dependencies_to_install)

    try:
        exit_code = subprocess.check_call(
            [
                python_path,
                "-m",
                "pip",
                "install",
                *[pin(dep_info) for dep_info in dependencies_to_install],
                "--disable-pip-version-check",
                "--no-warn-script-location",
                "--timeout",
                str(NETWORK_TIMEOUT),
                "--retries",
                str(NETWORK_RETRIES),
                *extra_index_args,
            ],
            env=ENV,
        )
        if exit_code != 0:
            raise ValueError("An error occurred while installing dependencies.")
    except OSError as e:
        # Handle disk space errors during installation
        if "No space left on device" in str(e) or e.errno == 28:
            raise OSError(
                "Disk space ran out during dependency installation. "
                "Please free up disk space and try again."
            ) from e
        raise

    for dep_info in dependencies_to_install:
        installed_packages[dep_info.package_name] = dep_info.version

    return len(dependencies_to_install)


async def install_dependencies(
    dependencies: list[DependencyInfo],
    update_progress_cb: UpdateProgressFn | None = None,
    logger: Logger | None = None,
):
    # If there's no progress callback, just install the dependencies synchronously
    if update_progress_cb is None:
        return install_dependencies_sync(dependencies)

    dependencies_to_install = filter_necessary_to_install(dependencies)
    if len(dependencies_to_install) == 0:
        return 0

    # Check available disk space before installing
    _total_space, free_space = check_disk_space()
    required_space = calculate_required_disk_space(dependencies_to_install)

    if free_space < required_space:
        free_mb = free_space / (1024 * 1024)
        required_mb = required_space / (1024 * 1024)
        raise OSError(
            f"Insufficient disk space. Available: {free_mb:.1f} MB, Required: {required_mb:.1f} MB. "
            "Please free up disk space and try again."
        )

    dependency_name_map = {
        dep_info.package_name: dep_info.display_name or dep_info.package_name
        for dep_info in dependencies_to_install
    }
    deps_count = len(dependencies_to_install)
    deps_counter = 0
    transitive_deps_counter = 0

    extra_index_args = build_index_args(dependencies_to_install)

    def get_progress_amount():
        transitive_progress = 1 - 1 / (2**transitive_deps_counter)
        progress = (deps_counter + transitive_progress) / (deps_count + 1)
        return min(max(0, progress), 1) * DEP_MAX_PROGRESS

    # Used to increment by a small amount between collect and download
    dep_small_incr = (DEP_MAX_PROGRESS / deps_count) / 2

    try:
        process = subprocess.Popen(
            [
                python_path,
                "-m",
                # TODO: Change this back to "pip" once pip updates with my changes
                "chainner_pip",
                "install",
                *[pin(dep_info) for dep_info in dependencies_to_install],
                "--disable-chainner_pip-version-check",
                "--no-warn-script-location",
                "--progress-bar=json",
                # Large wheels (the ROCm SDK is ~750 MB) are regularly cut off
                # mid-transfer by the vendor CDNs. Without an explicit timeout a
                # stalled socket never turns into an error and the install hangs
                # forever, so fail fast and retry instead.
                "--timeout",
                str(NETWORK_TIMEOUT),
                "--retries",
                str(NETWORK_RETRIES),
                *extra_index_args,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            encoding="utf-8",
            env=ENV,
        )
    except OSError as e:
        # Handle disk space errors when starting the process
        if "No space left on device" in str(e) or e.errno == 28:
            raise OSError(
                "Disk space ran out during dependency installation. "
                "Please free up disk space and try again."
            ) from e
        raise
    installing_name = "Unknown"
    error_output = []
    loop = asyncio.get_running_loop()

    # pip goes completely silent while it unpacks what it downloaded, which for
    # the ROCm SDK means several GB and several minutes. Reading the pipe with a
    # blocking call from inside a coroutine would freeze the whole event loop for
    # that entire stretch: no HTTP, no SSE, a progress bar stuck at its last
    # value and a UI that looks hung. So the read happens on a worker thread.
    installing_phase = False
    last_heartbeat = time.monotonic()
    pending_read: asyncio.Future[str] | None = None

    while True:
        # A timed-out read must not be abandoned: its thread keeps running and
        # would swallow the next line, so the same future is awaited again.
        if pending_read is None:
            pending_read = loop.run_in_executor(None, process.stdout.readline)  # type: ignore
        done, _ = await asyncio.wait({pending_read}, timeout=HEARTBEAT_INTERVAL)
        if not done:
            # No output for a while. Keep the UI alive instead of looking dead.
            if installing_phase and time.monotonic() - last_heartbeat >= HEARTBEAT_INTERVAL:
                last_heartbeat = time.monotonic()
                await update_progress_cb(
                    "Installing collected dependencies...", 0.9, None
                )
            continue
        nextline = pending_read.result()
        pending_read = None

        if not nextline:
            # EOF: pip closed its output, so it is done or dying.
            break

        line = nextline.strip()
        if not line:
            continue

        if logger is not None and not line.startswith("Progress:"):
            logger.info(line)

        # Check for disk space errors in the output
        if "No space left on device" in line or "OSError: [Errno 28]" in line:
            process.kill()
            process.wait()
            raise OSError(
                "Disk space ran out during dependency installation. "
                "Please free up disk space and try again."
            )

        # Collect error messages for better error reporting
        if "ERROR:" in line or "error:" in line.lower():
            error_output.append(line)

        # The Collecting step of pip. It tells us what package is being installed.
        if "Collecting" in line:
            match = COLLECTING_REGEX.search(line)
            if match:
                package_name = match.group(1)
                installing_name = dependency_name_map.get(package_name, None)
                if installing_name is None:
                    installing_name = package_name
                    transitive_deps_counter += 1
                else:
                    deps_counter += 1
                await update_progress_cb(
                    f"Collecting {installing_name}...", get_progress_amount(), None
                )
        # The Downloading step of pip. It tells us what package is currently being downloaded.
        # Later, we can use this to get the progress of the download.
        # For now, we just tell the user that it's happening.
        elif "Downloading" in line:
            await update_progress_cb(
                f"Downloading {installing_name}...",
                get_progress_amount() + dep_small_incr,
                None,
            )
        # We can parse this line to get the progress of the download, but only in our pip fork for now
        elif "Progress:" in line:
            json_line = line.replace("Progress:", "").strip()
            try:
                parsed = json.loads(json_line)
                current, total = parsed["current"], parsed["total"]
                if total is not None and total > 0:
                    percent = current / total
                    await update_progress_cb(
                        f"Downloading {installing_name}...",
                        get_progress_amount() + dep_small_incr,
                        percent,
                    )
            except Exception as e:
                if logger is not None:
                    logger.error(str(e))
                # pass
        # The Installing step of pip. Installs happen for all the collected packages at once.
        # We can't get the progress of the installation, so we just tell the user that it's happening.
        elif "Installing collected packages" in line:
            installing_phase = True
            last_heartbeat = time.monotonic()
            await update_progress_cb("Installing collected dependencies...", 0.9, None)

    exit_code = await loop.run_in_executor(None, process.wait)
    if exit_code != 0:
        # Check if any disk space errors were collected
        for error_line in error_output:
            if "No space left" in error_line or "disk" in error_line.lower():
                raise OSError(
                    "Disk space ran out during dependency installation. "
                    "Please free up disk space and try again."
                )

        # Provide detailed error message if available
        error_msg = "An error occurred while installing dependencies."
        if error_output:
            error_details = "\n".join(error_output[:3])  # Show first 3 error lines
            error_msg = f"{error_msg}\nDetails: {error_details}"
        raise ValueError(error_msg)

    await update_progress_cb("Finished installing dependencies...", 1, None)

    for dep_info in dependencies_to_install:
        installed_packages[dep_info.package_name] = dep_info.version

    return len(dependencies_to_install)


def uninstall_dependencies_sync(
    dependencies: list[DependencyInfo],
):
    if len(dependencies) == 0:
        return

    exit_code = subprocess.check_call(
        [
            python_path,
            "-m",
            "pip",
            "uninstall",
            *[d.package_name for d in dependencies],
            "-y",
        ],
        env=ENV,
    )
    if exit_code != 0:
        raise ValueError("An error occurred while uninstalling dependencies.")

    for dep_info in dependencies:
        installed_packages[dep_info.package_name] = dep_info.version


async def uninstall_dependencies(
    dependencies: list[DependencyInfo],
    update_progress_cb: UpdateProgressFn | None = None,
    logger: Logger | None = None,
):
    # If there's no progress callback, just uninstall the dependencies synchronously
    if update_progress_cb is None:
        return uninstall_dependencies_sync(dependencies)

    if len(dependencies) == 0:
        return

    dependency_name_map = {
        dep_info.package_name: dep_info.display_name or dep_info.package_name
        for dep_info in dependencies
    }
    deps_count = len(dependencies)
    deps_counter = 0
    transitive_deps_counter = 0

    def get_progress_amount():
        transitive_progress = 1 - 1 / (2**transitive_deps_counter)
        progress = (deps_counter + transitive_progress) / (deps_count + 1)
        return min(max(0, progress), 1)

    # Used to increment by a small amount between collect and download
    dep_small_incr = (1 / deps_count) / 2

    process = subprocess.Popen(
        [
            python_path,
            "-m",
            # TODO: Change this back to "pip" once pip updates with my changes
            "chainner_pip",
            "uninstall",
            *[d.package_name for d in dependencies],
            "-y",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        encoding="utf-8",
        env=ENV,
    )
    uninstalling_name = "Unknown"
    loop = asyncio.get_running_loop()

    # Same as in install_dependencies: never block the event loop on the pipe,
    # and never abandon a read that is still in flight.
    pending_read: asyncio.Future[str] | None = None
    while True:
        if pending_read is None:
            pending_read = loop.run_in_executor(None, process.stdout.readline)  # type: ignore
        done, _ = await asyncio.wait({pending_read}, timeout=HEARTBEAT_INTERVAL)
        if not done:
            continue
        nextline = pending_read.result()
        pending_read = None

        if not nextline:
            break

        line = nextline.strip()
        if not line:
            continue

        if logger is not None and not line.startswith("Progress:"):
            logger.info(line)

        # The Uninstalling step of pip. It tells us what package is being UNinstalled.
        if "Uninstalling" in line:
            match = UNINSTALLING_REGEX.search(line)
            if match:
                package_name = match.group(1)
                uninstalling_name = dependency_name_map.get(package_name, None)
                if uninstalling_name is None:
                    uninstalling_name = package_name
                    transitive_deps_counter += 1
                else:
                    deps_counter += 1
                await update_progress_cb(
                    f"Uninstalling {uninstalling_name}...", get_progress_amount(), None
                )
        # The Downloading step of pip. It tells us what package is currently being downloaded.
        # Later, we can use this to get the progress of the download.
        # For now, we just tell the user that it's happening.
        elif "Successfully uninstalled" in line:
            await update_progress_cb(
                f"Uninstalled {uninstalling_name}.",
                get_progress_amount() + dep_small_incr,
                None,
            )

    exit_code = await loop.run_in_executor(None, process.wait)
    if exit_code != 0:
        raise ValueError("An error occurred while uninstalling dependencies.")

    await update_progress_cb("Finished uninstalling dependencies...", 1, None)

    for dep_info in dependencies:
        del installed_packages[dep_info.package_name]


__all__ = [
    "ENV",
    "DependencyInfo",
    "install_dependencies",
    "install_dependencies_sync",
    "installed_packages",
    "python_path",
]
