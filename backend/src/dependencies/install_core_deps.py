from typing import List

from .store import DependencyInfo, install_dependencies

deps: List[DependencyInfo] = [
    {
        "package_name": "pynvml",
        "version": "11.5.0",
    },
    {
        "package_name": "typing_extensions",
        "version": "4.6.2",
    },
    {
        "package_name": "chainner_ext",
        "version": "0.0.0",
    },
]

install_dependencies(deps)
