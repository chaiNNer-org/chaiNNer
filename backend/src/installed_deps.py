import subprocess
import sys

python_path = sys.executable

# pylint: disable=global-at-module-level
global installed_packages
installed_packages = {}


def install_dependency(package_name, version):
    if package_name not in installed_packages:
        subprocess.check_call(
            [
                python_path,
                "-m",
                "pip",
                "install",
                "--upgrade",
                f"{package_name}=={version}",
            ]
        )
        installed_packages[package_name] = version


def set_installed_packages(packages):
    # pylint: disable=global-statement
    global installed_packages
    installed_packages = packages
