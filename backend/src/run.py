import importlib
import os

# Modules pick their logger by process type at import time, so this has to be set
# before anything imports `logger`. The worker sets it back to "worker".
os.environ["CHAINNER_PROCESS_TYPE"] = "host"

# Install server dependencies. Can't start the server without them, but we don't want to install the other deps yet.
importlib.import_module("dependencies.install_server_deps")

# Start the host server
server_host = importlib.import_module("server_host")
server_host.main()
