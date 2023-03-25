from sanic.log import logger

from api import add_package

package = add_package(__file__, name="chaiNNer_standard", dependencies=[])

logger.info(f"Loaded package {package.name}")
