class Category:
    def __init__(
        self, name: str, description: str, icon: str, color: str, install_hint: str = ""
    ):
        self.name = name
        self.description = description
        self.icon = icon
        self.color = color
        self.install_hint = install_hint

    def toDict(self):
        return {
            "name": self.name,
            "description": self.description,
            "icon": self.icon,
            "color": self.color,
            "installHint": self.install_hint,
        }

    def __repr__(self):
        return str(self.toDict())

    def __iter__(self):
        yield from self.toDict().items()

# Image Categories
ImageCategory = Category(
    name="Image", description="Base image nodes.", icon="BsFillImageFill", color="#C53030"
)
ImageDimensionCategory = Category(
    name="Image (Dimensions)",
    description="Nodes that deal with changing the dimensions/resolution of images.",
    icon="MdOutlinePhotoSizeSelectLarge",
    color="#3182CE",
)
ImageAdjustmentCategory = Category(
    name="Image (Adjustments)",
    description="Nodes that deal with adjusting properties of images.",
    icon="BsSliders",
    color="#319795",
)
ImageFilterCategory = Category(
    name="Image (Filters)",
    description="Nodes that deal with filtering images.",
    icon="MdFilterAlt",
    color="#38A169",
)
ImageUtilityCategory = Category(
    name="Image (Utilities)",
    description="Various utility nodes for images.",
    icon="BsGear",
    color="#00A3C4",
)
ImageChannelCategory = Category(
    name="Image (Channels)",
    description="Nodes that deal with manipulating channels of images.",
    icon="MdAllOut",
    color="#D69E2E",
)

# NN Categories
PyTorchCategory = Category(
    name="PyTorch",
    description="Nodes for using the PyTorch Neural Network Framework with images.",
    icon="PyTorch",
    color="#DD6B20",
    install_hint="PyTorch uses .pth models to upscale images. It is the most widely-used upscaling architecture. However, it does not support AMD GPUs.",
)
ONNXCategory = Category(
    name="ONNX",
    description="Nodes for using the ONNX Neural Network Framework with images.",
    icon="ONNX",
    color="#63B3ED",
    install_hint="ONNX uses .onnx models to upscale images. It does not support AMD GPUs.",
)
NCNNCategory = Category(
    name="NCNN",
    description="Nodes for using the NCNN Neural Network Framework with images.",
    icon="NCNN",
    color="#ED64A6",
    install_hint="NCNN uses .bin/.param models to upscale images. It is recommended for AMD users because it supports both AMD and Nvidia GPUs.",
)

# Etc
UtilityCategory = Category(
    name="Utility",
    description="Various utility nodes.",
    icon="BsGearFill",
    color="#718096",
)

categories = [
    ImageCategory,
    ImageDimensionCategory,
    ImageAdjustmentCategory,
    ImageFilterCategory,
    ImageUtilityCategory,
    ImageChannelCategory,
    PyTorchCategory,
    ONNXCategory,
    NCNNCategory,
    UtilityCategory,
]

category_order = [x.name for x in categories]
