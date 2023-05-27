from system import is_arm_mac, is_windows

from .versioned_dependency_helpers import install_version_checked_dependency

# I'm leaving this here in case I can use the Dependency class in the future, so I don't lose the extra info

# dependencies=[
#         Dependency("OpenCV", "opencv-python", "4.7.0.68", 30 * MB, import_name="cv2"),
#         Dependency("NumPy", "numpy", "1.23.2", 15 * MB),
#         Dependency("Pillow (PIL)", "Pillow", "9.2.0", 3 * MB, import_name="PIL"),
#         Dependency("appdirs", "appdirs", "1.4.4", 13.5 * KB),
#         Dependency("FFMPEG", "ffmpeg-python", "0.2.0", 25 * KB, import_name="ffmpeg"),
#         Dependency("Requests", "requests", "2.28.2", 452 * KB),
#         Dependency("re2", "google-re2", "1.0", 275 * KB, import_name="re2"),
#         Dependency("scipy", "scipy", "1.9.3", 42 * MB),
#     ],

# if is_arm_mac:
#     package.add_dependency(Dependency("Pasteboard", "pasteboard", "0.3.3", 19 * KB))
# elif is_windows:
#     package.add_dependency(
#         Dependency("Pywin32", "pywin32", "304", 12 * MB, import_name="win32clipboard")
#     )

deps = [
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
    {"package_name": "pynvml", "version": "11.5.0"},
    {"package_name": "typing-extensions", "version": "4.6.2"},
]

if is_arm_mac:
    deps.append({"package_name": "pasteboard", "version": "0.3.3"})
elif is_windows:
    deps.append({"package_name": "pywin32", "version": "304"})


for dependency in deps:
    install_version_checked_dependency(
        dependency["package_name"], dependency["version"]
    )
