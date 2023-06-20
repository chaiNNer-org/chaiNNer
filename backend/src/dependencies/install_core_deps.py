from typing import List

from .store import DependencyInfo, install_dependencies_sync

deps: List[DependencyInfo] = [
    {
        "package_name": "pynvml",
        "display_name": "pynvml",
        "version": "11.5.0",
    },
    {
        "package_name": "typing_extensions",
        "display_name": "typing_extensions",
        "version": "4.6.2",
    },
    {
        "package_name": "numpy",
        "display_name": "NumPy",
        "version": "1.23.2",
    },
]

install_dependencies_sync(deps)
