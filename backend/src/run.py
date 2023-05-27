import importlib

# Install absolutely required dependencies -- aka anything we need to install other dependencies properly (e.g. semver)
importlib.import_module("dependencies.install_essential_deps")

# Install other required dependencies (now we can use semver for version checking)
importlib.import_module("dependencies.install_required_deps")

# Now we can start the server since we have sanic installed
main_server = importlib.import_module("server")
main_server.main()
