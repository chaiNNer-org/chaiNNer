import subprocess
import sys
from typing import Dict, List, TypedDict, Union

python_path = sys.executable

installed_packages: Dict[str, Union[str, None]] = {}


class DependencyInfo(TypedDict):
    package_name: str
    version: Union[str, None]


def pin(package_name: str, version: Union[str, None]) -> str:
    if version is None:
        return package_name
    return f"{package_name}=={version}"


def install_dependencies(dependency_info_array: List[DependencyInfo]):
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


__all__ = [
    "DependencyInfo",
    "python_path",
    "install_dependencies",
    "installed_packages",
]
