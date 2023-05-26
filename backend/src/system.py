import platform
import sys

is_mac = sys.platform == "darwin"
is_arm_mac = is_mac and platform.machine() == "arm64"
is_windows = sys.platform == "win32"
is_linux = sys.platform == "linux"
