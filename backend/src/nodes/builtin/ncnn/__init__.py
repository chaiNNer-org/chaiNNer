from ...api.category import Category

category = Category(
    name="NCNN",
    description="Nodes for using the NCNN Neural Network Framework with images.",
    icon="NCNN",
    color="#ED64A6",
    install_hint="NCNN uses .bin/.param models to upscale images. It is recommended for AMD users because it supports both AMD and Nvidia GPUs.",
)
