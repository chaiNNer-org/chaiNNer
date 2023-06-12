import importlib

# Install server dependencies. Can't start the server without them, but we don't want to install the other deps yet.
importlib.import_module("dependencies.install_server_deps")

# Now we can start the server since we have sanic installed
main_server = importlib.import_module("server")
main_server.main()

# Installing the rest of the dependencies is done in server.py
