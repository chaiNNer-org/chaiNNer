import importlib

# Install server dependencies. Can't start the server without them, but we don't want to install the other deps yet.
importlib.import_module("dependencies.install_server_deps")

# Start the host server
server_host = importlib.import_module("server_host")
server_host.main()
