import re
from typing import List

from semver.version import Version

from .store import DependencyInfo, install_dependencies, installed_packages


def coerce_semver(version: str) -> Version:
    try:
        return Version.parse(version, True)
    except Exception:
        regex = r"(\d+)\.(\d+)\.(\d+)"
        match = re.search(regex, version)
        if match:
            return Version(
                int(match.group(1)),
                int(match.group(2)),
                int(match.group(3)),
            )
        return Version(0, 0, 0)


def install_version_checked_dependencies(dependencies: List[DependencyInfo]):
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
        install_dependencies(dependencies_to_install)
