import re
import subprocess
import sys
from typing import Dict, List, Tuple, TypedDict, Union

python_path = sys.executable

installed_packages: Dict[str, Union[str, None]] = {}


class DependencyInfo(TypedDict):
    package_name: str
    version: Union[str, None]


def pin(package_name: str, version: Union[str, None]) -> str:
    if version is None:
        return package_name
    return f"{package_name}=={version}"


def install_dependencies_impl(dependency_info_array: List[DependencyInfo]):
    subprocess.check_call(
        [
            python_path,
            "-m",
            "pip",
            "install",
            *[
                pin(dep_info["package_name"], dep_info["version"])
                for dep_info in dependency_info_array
            ],
            "--disable-pip-version-check",
            "--no-warn-script-location",
        ]
    )
    for dep_info in dependency_info_array:
        package_name = dep_info["package_name"]
        version = dep_info["version"]
        installed_packages[package_name] = version


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


def install_dependencies(dependencies: List[DependencyInfo]):
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
    if len(dependencies_to_install) > 0:
        install_dependencies_impl(dependencies_to_install)


__all__ = [
    "DependencyInfo",
    "python_path",
    "install_dependencies",
    "installed_packages",
]
