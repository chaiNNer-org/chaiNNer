import re
import subprocess
import sys
from typing import Dict, List, Optional, Tuple, TypedDict, Union

from custom_types import UpdateProgressFn

python_path = sys.executable

installed_packages: Dict[str, Union[str, None]] = {}

COLLECTING_REGEX = re.compile(r"Collecting ([a-zA-Z0-9-_]+)")


class DependencyInfo(TypedDict):
    package_name: str
    display_name: Optional[str]
    version: Union[str, None]


def pin(package_name: str, version: Union[str, None]) -> str:
    if version is None:
        return package_name
    return f"{package_name}=={version}"


def coerce_semver(version: str) -> Tuple[int, int, int]:
    regex = r"(\d+)(?:\.(\d+)(?:\.(\d+))?)?"
    match = re.search(regex, version)
    if match:
        return (
            int(match.group(1) or 0),
            int(match.group(2) or 0),
            int(match.group(3) or 0),
        )
    return (0, 0, 0)


def get_deps_to_install(dependencies: List[DependencyInfo]):
    dependencies_to_install = []
    for dependency in dependencies:
        version = installed_packages.get(dependency["package_name"], None)
        if dependency["version"] and version:
            installed_version = coerce_semver(version)
            dep_version = coerce_semver(dependency["version"])
            if installed_version < dep_version:
                dependencies_to_install.append(dependency)
        elif not version:
            dependencies_to_install.append(dependency)
    return dependencies_to_install


def install_dependencies_sync(
    dependencies: List[DependencyInfo],
):
    dependencies_to_install = get_deps_to_install(dependencies)
    if len(dependencies_to_install) == 0:
        return

    subprocess.check_call(
        [
            python_path,
            "-m",
            "pip",
            "install",
            *[
                pin(dep_info["package_name"], dep_info["version"])
                for dep_info in dependencies_to_install
            ],
            "--disable-pip-version-check",
            "--no-warn-script-location",
        ]
    )
    for dep_info in dependencies_to_install:
        package_name = dep_info["package_name"]
        version = dep_info["version"]
        installed_packages[package_name] = version


async def install_dependencies(
    dependencies: List[DependencyInfo],
    update_progress_cb: Optional[UpdateProgressFn] = None,
):
    # If there's no progress callback, just install the dependencies synchronously
    if update_progress_cb is None:
        install_dependencies_sync(dependencies)
        return

    dependencies_to_install = get_deps_to_install(dependencies)
    if len(dependencies_to_install) == 0:
        return

    dependency_name_map = {
        dep_info["package_name"]: dep_info["display_name"]
        for dep_info in dependencies_to_install
    }
    dep_length = len(dependencies_to_install)
    dep_counter = 0

    DEP_MAX_PROGRESS = 0.8

    def get_progress_amount():
        return min(max(0, dep_counter / dep_length), 1) * DEP_MAX_PROGRESS

    # Used to increment by a small amount between collect and download
    dep_small_incr = (DEP_MAX_PROGRESS / dep_length) / 2

    process = subprocess.Popen(
        [
            python_path,
            "-m",
            "pip",
            "install",
            *[
                pin(dep_info["package_name"], dep_info["version"])
                for dep_info in dependencies_to_install
            ],
            "--disable-pip-version-check",
            "--no-warn-script-location",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    installing_name = "Unknown"
    while True:
        nextline = process.stdout.readline()  # type: ignore
        if nextline == b"" and process.poll() is not None:
            break
        line = nextline.decode("utf-8").strip()
        # The Collecting step of pip. It tells us what package is being installed.
        if "Collecting" in line:
            match = COLLECTING_REGEX.search(line)
            if match:
                package_name = match.group(1)
                installing_name = dependency_name_map.get(package_name, package_name)
                dep_counter += 1
                await update_progress_cb(
                    f"Collecting {installing_name}...", get_progress_amount()
                )
        # The Downloading step of pip. It tells us what package is currently being downloaded.
        # Later, we can use this to get the progress of the download.
        # For now, we just tell the user that it's happening.
        elif "Downloading" in line:
            await update_progress_cb(
                f"Downloading {installing_name}...",
                get_progress_amount() + dep_small_incr,
            )
        # The Installing step of pip. Installs happen for all the collected packages at once.
        # We can't get the progress of the installation, so we just tell the user that it's happening.
        elif "Installing collected packages" in line:
            await update_progress_cb(f"Installing collected packages...", 0.9)

    process.wait()
    await update_progress_cb(f"Installing collected packages...", 1)

    for dep_info in dependencies_to_install:
        installing_name = dep_info["package_name"]
        version = dep_info["version"]
        installed_packages[installing_name] = version


__all__ = [
    "DependencyInfo",
    "python_path",
    "install_dependencies",
    "install_dependencies_sync",
    "installed_packages",
]
