import sys

from sanic.log import logger

from api import Feature, add_package

_FEATURE_DESCRIPTION = f"""
ChaiNNer can connect to [AUTOMATIC1111's Stable Diffusion Web UI](https://github.com/AUTOMATIC1111/stable-diffusion-webui) to run Stable Diffusion nodes.

If you want to use the External Stable Diffusion nodes, run the Automatic1111 web WI with the `--api` flag, like so:

```bash
./webui.{"bat" if sys.platform == "win32" else "sh"} --api
```

To manually set where chaiNNer looks for the API, use the `STABLE_DIFFUSION_PROTOCOL`, `STABLE_DIFFUSION_HOST`, and `STABLE_DIFFUSION_PORT` environment variables. By default, `127.0.0.1` will be the host. If not specified, chaiNNer will try to auto-detect the protocol and port.
"""

package = add_package(
    __file__,
    name="External",
    description="Interact with an external Stable Diffusion API",
    features=[
        Feature(
            id="webui",
            name="AUTOMATIC1111/stable-diffusion-webui",
            description=_FEATURE_DESCRIPTION,
        )
    ],
)

external_stable_diffusion_category = package.add_category(
    name="Stable Diffusion (External)",
    description="Interact with an external Stable Diffusion API",
    icon="FaPaintBrush",
    color="#9331CC",
)

logger.debug(f"Loaded package {package.name}")
