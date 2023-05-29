import subprocess
import sys

python_path = sys.executable

# pylint: disable=global-at-module-level
global installed_packages
installed_packages = {}


def install_dependency(package_name, version):
    print(f"Installing {package_name}=={version}")
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
        print(f"Installed {package_name}=={version} | {installed_packages}")


__all__ = [
    "python_path",
    "install_dependency",
    "installed_packages",
]
