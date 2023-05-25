import subprocess
import sys
from json import loads as json_parse

from installed_deps import install_dependency, set_installed_packages

## ONLY IMPORT PYTHON STANDARD LIBRARY MODULES ABOVE HERE

python_path = sys.executable

# Get the list of installed packages
# We can't rely on using the package's __version__ attribute because not all packages actually have it
try:
    pip_list = subprocess.check_output(
        [python_path, "-m", "pip", "list", "--format=json"]
    )
    set_installed_packages({p["name"]: p["version"] for p in json_parse(pip_list)})
except Exception as e:
    # logger.error(f"Failed to get installed packages: {e}")
    set_installed_packages({})

# dependencies=[
#         Dependency("OpenCV", "opencv-python", "4.7.0.68", 30 * MB, import_name="cv2"),
#         # Dependency("NumPy", "numpy", "1.23.2", 15 * MB),
#         Dependency("Pillow (PIL)", "Pillow", "9.2.0", 3 * MB, import_name="PIL"),
#         Dependency("appdirs", "appdirs", "1.4.4", 13.5 * KB),
#         Dependency("FFMPEG", "ffmpeg-python", "0.2.0", 25 * KB, import_name="ffmpeg"),
#         Dependency("Requests", "requests", "2.28.2", 452 * KB),
#         Dependency("re2", "google-re2", "1.0", 275 * KB, import_name="re2"),
#         Dependency("scipy", "scipy", "1.9.3", 42 * MB),
#     ],

initial_required_dependencies = [
    {
        "package_name": "sanic",
        "version": "23.3.0",
    },
    {
        "package_name": "Sanic-Cors",
        "version": "2.2.0",
    },
    # {"package_name": "pynvml", "version": "11.5.0"},
    {
        "package_name": "semver",
        "version": "3.0.0",
    },
]


# Note: We can't be sure we have semver yet so we can't use it to compare versions
def install_required_dependencies():
    for dependency in initial_required_dependencies:
        # if dependency["package_name"] not in installed_packages:
        #     subprocess.check_call(
        #         [
        #             python_path,
        #             "-m",
        #             "pip",
        #             "install",
        #             "--upgrade",
        #             f"{dependency['package_name']}=={dependency['version']}",
        #         ]
        #     )
        #     installed_packages[dependency["package_name"]] = dependency["version"]
        install_dependency(dependency["package_name"], dependency["version"])


install_required_dependencies()

other_required_dependencies = [
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
    {
        "package_name": "appdirs",
        "version": "1.4.4",
    },
    {
        "package_name": "ffmpeg-python",
        "version": "0.2.0",
    },
    {
        "package_name": "requests",
        "version": "2.28.2",
    },
    {
        "package_name": "google-re2",
        "version": "1.0",
    },
    {
        "package_name": "scipy",
        "version": "1.9.3",
    },
]

# pylint: disable=wrong-import-position
from versioned_dependency_helpers import install_version_checked_dependency


def install_other_required_dependencies():
    for dependency in other_required_dependencies:
        install_version_checked_dependency(
            dependency["package_name"], dependency["version"]
        )


install_other_required_dependencies()
