from typing import List

from .store import DependencyInfo, install_dependencies_sync

deps: List[DependencyInfo] = [
    {
        "package_name": "pynvml",
        "display_name": "pynvml",
        "version": "11.5.0",
        "from_file": "pynvml-11.5.0-py3-none-any.whl",
    },
    {
        "package_name": "typing_extensions",
        "display_name": "typing_extensions",
        "version": "4.6.3",
        "from_file": "typing_extensions-4.6.3-py3-none-any.whl",
    },
]

install_dependencies_sync(deps)
