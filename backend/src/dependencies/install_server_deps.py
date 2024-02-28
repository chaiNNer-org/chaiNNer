from __future__ import annotations

import subprocess
from json import loads as json_parse

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


deps: list[DependencyInfo] = [
    DependencyInfo(
        package_name="sanic",
        display_name="Sanic",
        version="23.3.0",
        from_file="sanic-23.3.0-py3-none-any.whl",
    ),
    DependencyInfo(
        package_name="Sanic-Cors",
        version="2.2.0",
        from_file="Sanic_Cors-2.2.0-py2.py3-none-any.whl",
    ),
    # Sanic's downstream deps that are py3-non-any
    DependencyInfo(
        package_name="aiofiles",
        version="23.1.0",
        from_file="aiofiles-23.1.0-py3-none-any.whl",
    ),
    DependencyInfo(
        package_name="html5tagger",
        version="1.3.0",
        from_file="html5tagger-1.3.0-py3-none-any.whl",
    ),
    DependencyInfo(
        package_name="sanic-routing",
        version="22.8.0",
        from_file="sanic_routing-22.8.0-py3-none-any.whl",
    ),
    DependencyInfo(
        package_name="tracerite",
        version="1.1.0",
        from_file="tracerite-1.1.0-py3-none-any.whl",
    ),
    # Sanic's downstream deps that we want to pin anyway
    DependencyInfo(
        package_name="websockets",
        version="11.0.3",
    ),
    # Other deps necessary for general use
    DependencyInfo(
        package_name="typing_extensions",
        version="4.6.2",
        from_file="typing_extensions-4.6.3-py3-none-any.whl",
    ),
    DependencyInfo(
        package_name="pynvml",
        version="11.5.0",
        from_file="pynvml-11.5.0-py3-none-any.whl",
    ),
    DependencyInfo(
        package_name="chainner-pip",
        version="23.2.0",
        from_file="chainner_pip-23.2.0-py3-none-any.whl",
    ),
    DependencyInfo(
        package_name="psutil",
        version="5.9.5",
    ),
    DependencyInfo(
        package_name="aiohttp",
        version="3.9.3",
    ),
]

install_dependencies_sync(deps)
