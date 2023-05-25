import importlib

# Install dependencies
importlib.import_module("setup_deps")

# Run server
main_server = importlib.import_module("server")
main_server.main()
