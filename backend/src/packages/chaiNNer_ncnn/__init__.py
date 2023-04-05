from sanic.log import logger

from api import add_package

package = add_package(__file__, name="chaiNNer_ncnn", dependencies=[])

ncnn_category = package.add_category(
    name="NCNN",
    description="Nodes for using the NCNN Neural Network Framework with images.",
    icon="NCNN",
    color="#ED64A6",
    install_hint="NCNN uses .bin/.param models to upscale images. It is recommended for AMD users because it supports both AMD and Nvidia GPUs.",
)


logger.debug(f"Loaded package {package.name}")
