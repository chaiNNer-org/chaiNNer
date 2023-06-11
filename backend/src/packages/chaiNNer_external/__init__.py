from sanic.log import logger

from api import add_package

package = add_package(
    __file__,
    name="External",
    description="Interact with an external Stable Diffusion API",
    dependencies=[],
)

external_stable_diffusion_category = package.add_category(
    name="Stable Diffusion (External)",
    description="Interact with an external Stable Diffusion API",
    icon="FaPaintBrush",
    color="#9331CC",
)

logger.debug(f"Loaded package {package.name}")
