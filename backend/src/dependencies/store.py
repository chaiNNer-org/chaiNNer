from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from logging import Logger

from custom_types import UpdateProgressFn

python_path = sys.executable
dir_path = os.path.dirname(os.path.realpath(__file__))

installed_packages: dict[str, str] = {}

COLLECTING_REGEX = re.compile(r"Collecting ([a-zA-Z0-9-_]+)")
UNINSTALLING_REGEX = re.compile(r"Uninstalling ([a-zA-Z0-9-_]+)-+")

DEP_MAX_PROGRESS = 0.8


@dataclass(frozen=True)
class DependencyInfo:
    package_name: str
    version: str
    display_name: str | None = None
    from_file: str | None = None
    extra_index_url: str | None = None


def pin(dependency: DependencyInfo) -> str:
    package_name = dependency.package_name

    if dependency.from_file is not None:
        whl_file = f"{dir_path}/whls/{package_name}/{dependency.from_file}"
        if os.path.isfile(whl_file):
            return whl_file

    return f"{package_name}=={dependency.version}"


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


def get_deps_to_install(dependencies: list[DependencyInfo]):
    dependencies_to_install: list[DependencyInfo] = []
    for dependency in dependencies:
        version = installed_packages.get(dependency.package_name, None)
        if version:
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
    dependencies_to_install = get_deps_to_install(dependencies)
    if len(dependencies_to_install) == 0:
        return 0

    extra_index_urls = {
        dep_info.extra_index_url
        for dep_info in dependencies_to_install
        if dep_info.extra_index_url
    }

    extra_index_args = []
    if len(extra_index_urls) > 0:
        extra_index_args.extend(["--extra-index-url", ",".join(extra_index_urls)])

    exit_code = subprocess.check_call(
        [
            python_path,
            "-m",
            "pip",
            "install",
            *[pin(dep_info) for dep_info in dependencies_to_install],
            "--disable-pip-version-check",
            "--no-warn-script-location",
            *extra_index_args,
        ],
    )
    if exit_code != 0:
        raise ValueError("An error occurred while installing dependencies.")

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

    dependencies_to_install = get_deps_to_install(dependencies)
    if len(dependencies_to_install) == 0:
        return 0

    dependency_name_map = {
        dep_info.package_name: dep_info.display_name or dep_info.package_name
        for dep_info in dependencies_to_install
    }
    deps_count = len(dependencies_to_install)
    deps_counter = 0
    transitive_deps_counter = 0

    extra_index_urls = {
        dep_info.extra_index_url
        for dep_info in dependencies_to_install
        if dep_info.extra_index_url
    }

    extra_index_args = []
    if len(extra_index_urls) > 0:
        extra_index_args.extend(["--extra-index-url", ",".join(extra_index_urls)])

    def get_progress_amount():
        transitive_progress = 1 - 1 / (2**transitive_deps_counter)
        progress = (deps_counter + transitive_progress) / (deps_count + 1)
        return min(max(0, progress), 1) * DEP_MAX_PROGRESS

    # Used to increment by a small amount between collect and download
    dep_small_incr = (DEP_MAX_PROGRESS / deps_count) / 2

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
            "--no-cache-dir",
            *extra_index_args,
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        encoding="utf-8",
    )
    installing_name = "Unknown"
    while True:
        nextline = process.stdout.readline()  # type: ignore
        if process.poll() is not None:
            break
        line = nextline.strip()
        if not line:
            continue

        if logger is not None and not line.startswith("Progress:"):
            logger.info(line)

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
            await update_progress_cb("Installing collected dependencies...", 0.9, None)

    exit_code = process.wait()
    if exit_code != 0:
        raise ValueError("An error occurred while installing dependencies.")

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
    )
    uninstalling_name = "Unknown"
    while True:
        nextline = process.stdout.readline()  # type: ignore
        if process.poll() is not None:
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

    exit_code = process.wait()
    if exit_code != 0:
        raise ValueError("An error occurred while installing dependencies.")

    await update_progress_cb("Finished installing dependencies...", 1, None)

    for dep_info in dependencies:
        del installed_packages[dep_info.package_name]


__all__ = [
    "DependencyInfo",
    "python_path",
    "install_dependencies",
    "install_dependencies_sync",
    "installed_packages",
]
