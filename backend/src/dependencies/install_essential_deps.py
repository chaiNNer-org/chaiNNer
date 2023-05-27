from .store import install_dependency

# These are the dependencies we _absolutely need_ to install before we can do anything else
deps = [
    {
        "package_name": "semver",
        "version": "3.0.0",
    },
]


# Note: We can't be sure we have semver yet so we can't use it to compare versions
for dependency in deps:
    install_dependency(dependency["package_name"], dependency["version"])
