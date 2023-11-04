import contextlib

from .file_outputs import *
from .generic_outputs import *
from .numpy_outputs import *

with contextlib.suppress(Exception):
    from .ncnn_outputs import *
with contextlib.suppress(Exception):
    from .onnx_outputs import *
with contextlib.suppress(Exception):
    from .pytorch_outputs import *
