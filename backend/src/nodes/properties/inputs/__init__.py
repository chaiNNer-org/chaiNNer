from nodes.base_input import *  # noqa

from .file_inputs import *  # noqa
from .generic_inputs import *  # noqa
from .image_dropdown_inputs import *  # noqa
from .numeric_inputs import *  # noqa
from .numpy_inputs import *  # noqa

try:
    from .ncnn_inputs import *  # noqa
except Exception:
    pass
try:
    from .onnx_inputs import *  # noqa
except Exception:
    pass
try:
    from .pytorch_inputs import *  # noqa
except Exception:
    pass
