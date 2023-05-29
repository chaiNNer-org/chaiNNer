import re

from semver.version import Version

from .store import install_dependency, installed_packages


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


def install_version_checked_dependency(package_name: str, package_version: str):
    version = installed_packages.get(package_name, None)
    if package_version and version:
        installed_version = coerce_semver(version)
        dep_version = coerce_semver(package_version)
        if installed_version < dep_version:
            install_dependency(package_name, package_version)
    elif not version:
        install_dependency(package_name, package_version)
