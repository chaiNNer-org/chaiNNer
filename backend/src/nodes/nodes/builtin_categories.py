from .image import category as ImageCategory
from .image_adjustment import category as ImageAdjustmentCategory
from .image_filter import category as ImageFilterCategory
from .image_dimension import category as ImageDimensionCategory
from .image_channel import category as ImageChannelCategory
from .image_utility import category as ImageUtilityCategory
from .rest import category as RESTCategory
from .utility import category as UtilityCategory
from .pytorch import category as PyTorchCategory
from .ncnn import category as NCNNCategory
from .onnx import category as ONNXCategory


builtin_categories = [
    ImageCategory,
    RESTCategory,
    ImageDimensionCategory,
    ImageAdjustmentCategory,
    ImageFilterCategory,
    ImageUtilityCategory,
    ImageChannelCategory,
    UtilityCategory,
    PyTorchCategory,
    NCNNCategory,
    ONNXCategory,
]
category_order = [x.name for x in builtin_categories]
