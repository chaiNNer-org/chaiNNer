import subprocess
from json import loads as json_parse
from typing import List

from .store import (
    DependencyInfo,
    install_dependencies_sync,
    installed_packages,
    python_path,
)

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
        "display_name": "Sanic",
        "version": "23.3.0",
        "from_file": "sanic-23.3.0-py3-none-any.whl",
    },
    {
        "package_name": "Sanic-Cors",
        "display_name": "Sanic-Cors",
        "version": "2.2.0",
        "from_file": "Sanic_Cors-2.2.0-py2.py3-none-any.whl",
    },
    {
        "package_name": "numpy",
        "display_name": "NumPy",
        "version": "1.23.2",
        "from_file": None,
    },
]

install_dependencies_sync(deps)
