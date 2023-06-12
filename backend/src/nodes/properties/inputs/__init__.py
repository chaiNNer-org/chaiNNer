from nodes.base_input import *

from .file_inputs import *
from .generic_inputs import *
from .image_dropdown_inputs import *
from .numeric_inputs import *
from .numpy_inputs import *

try:
    from .ncnn_inputs import *
except:
    pass
try:
    from .onnx_inputs import *
except:
    pass
try:
    from .pytorch_inputs import *
except:
    pass
