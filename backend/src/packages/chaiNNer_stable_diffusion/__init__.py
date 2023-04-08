from sanic.log import logger

from api import add_package

package = add_package(__file__, name="chaiNNer_stable_diffusion", dependencies=[])

stable_diffusion_category = package.add_category(
    name="Stable Diffusion",
    description="Nodes for using Stable Diffusion",
    icon="PyTorch",
    color="#9331CC",
)

logger.debug(f"Loaded package {package.name}")
