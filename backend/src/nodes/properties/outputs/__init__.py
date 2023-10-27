from nodes.base_output import *  # noqa: F403

from .file_outputs import *  # noqa: F403
from .generic_outputs import *  # noqa: F403
from .numpy_outputs import *  # noqa: F403

try:
    from .ncnn_outputs import *  # noqa: F403
except Exception:
    pass
try:
    from .onnx_outputs import *  # noqa: F403
except Exception:
    pass
try:
    from .pytorch_outputs import *  # noqa: F403
except Exception:
    pass
