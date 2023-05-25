import re
import subprocess

from semver.version import Version

from installed_deps import installed_packages, python_path


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
    version = installed_packages[package_name]
    if package_version and version:
        installed_version = coerce_semver(version)
        dep_version = coerce_semver(package_version)
        if installed_version < dep_version:
            # logger.info(
            #     f"Updating {dependency.package_name} from {version} to {dependency.version}..."
            # )
            # use pip to install
            subprocess.check_call(
                [
                    python_path,
                    "-m",
                    "pip",
                    "install",
                    "--upgrade",
                    f"{package_name}=={package_version}",
                ]
            )
            installed_packages[package_name] = package_version
