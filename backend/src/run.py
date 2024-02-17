import importlib
import sys

# Install server dependencies. Can't start the server without them, but we don't want to install the other deps yet.
importlib.import_module("dependencies.install_server_deps")

# Get current python location
python_location = sys.executable

print("python_location", python_location)


# def find_free_port():
#     return 8000
#     with socket.socket() as s:
#         s.bind(("", 0))  # Bind to a free port provided by the host.
#         return s.getsockname()[1]  # Return the port number assigned.


# port = find_free_port()

# print(f"Starting server on port {port}")


# Start the server in a subprocess
# process = subprocess.Popen(
#     [python_location, "./server.py", str(port)],
#     shell=False,
#     stdin=None,
#     stdout=subprocess.PIPE,
#     stderr=subprocess.PIPE,
# )

# if process.stdout is None:
#     print("Failed to start server")
#     sys.exit(1)

# # out, err = process.communicate()

# for stdout_line in iter(process.stdout.readline, ""):
#     print(stdout_line.decode(), end="")

# Get full path of server file
# server_file = os.path.join(os.path.dirname(__file__), "server_host.py")

# with subprocess.Popen(
#     [python_location, server_file, str(port)],
#     shell=False,
#     stdin=None,
#     stdout=subprocess.PIPE,
#     stderr=subprocess.PIPE,
# ) as process:
#     if process.stdout is None:
#         print("Failed to start server")
#         sys.exit(1)
#     for line in process.stdout:
#         print(line.decode(), end="")

# while True:
#     output = process.stdout.readline()
#     if output == b"" and process.poll() is not None:
#         break
#     if output:
#         print(output.strip())


# Now we can start the server since we have sanic installed
# main_server = importlib.import_module("server")
# main_server.main()

# Installing the rest of the dependencies is done in server.py


import server_host

server_host.main()
