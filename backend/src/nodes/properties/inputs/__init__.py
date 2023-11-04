import contextlib

from .file_inputs import *
from .generic_inputs import *
from .image_dropdown_inputs import *
from .numeric_inputs import *
from .numpy_inputs import *

with contextlib.suppress(Exception):
    from .ncnn_inputs import *
with contextlib.suppress(Exception):
    from .onnx_inputs import *
with contextlib.suppress(Exception):
    from .pytorch_inputs import *
