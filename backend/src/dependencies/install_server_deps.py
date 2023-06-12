import subprocess
from json import loads as json_parse
from typing import List

from .store import DependencyInfo, install_dependencies, installed_packages, python_path

# Get the list of installed packages
# We can't rely on using the package's __version__ attribute because not all packages actually have it
try:
    pip_list = subprocess.check_output(
        [
            python_path,
            "-m",
            "pip",
            "list",
            "--format=json",
            "--disable-pip-version-check",
        ]
    )
    for p in json_parse(pip_list):
        installed_packages[p["name"]] = p["version"]
except Exception as e:
    print(f"Failed to get installed packages: {e}")


deps: List[DependencyInfo] = [
    {
        "package_name": "sanic",
        "version": "23.3.0",
    },
    {
        "package_name": "Sanic-Cors",
        "version": "2.2.0",
    },
    {
        "package_name": "numpy",
        "version": "1.23.2",
    },
    {
        "package_name": "opencv-python",
        "version": "4.7.0.68",
    },
    {
        "package_name": "Pillow",
        "version": "9.2.0",
    },
]

install_dependencies(deps)
