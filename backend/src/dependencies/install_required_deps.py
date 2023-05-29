import subprocess
from json import loads as json_parse

from .store import installed_packages, python_path
from .versioned_dependency_helpers import install_version_checked_dependency

# Get the list of installed packages
# We can't rely on using the package's __version__ attribute because not all packages actually have it
try:
    pip_list = subprocess.check_output(
        [python_path, "-m", "pip", "list", "--format=json"]
    )
    # set_installed_packages({p["name"]: p["version"] for p in json_parse(pip_list)})
    for p in json_parse(pip_list):
        installed_packages[p["name"]] = p["version"]
except Exception as e:
    installed_packages = {}


deps = [
    {
        "package_name": "sanic",
        "version": "23.3.0",
    },
    {
        "package_name": "Sanic-Cors",
        "version": "2.2.0",
    },
]

for dependency in deps:
    install_version_checked_dependency(
        dependency["package_name"], dependency["version"]
    )
