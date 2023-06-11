from typing import List

from .store import DependencyInfo, install_dependencies

# These are the dependencies we _absolutely need_ to install before we can do anything else
deps: List[DependencyInfo] = [
    {
        "package_name": "semver",
        "version": "3.0.0",
    },
]


# Note: We can't be sure we have semver yet so we can't use it to compare versions
install_dependencies(deps)
