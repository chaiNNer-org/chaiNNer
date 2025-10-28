import sys

from api import add_package
from logger import logger

package = add_package(
    __file__,
    id="chaiNNer_external",
    name="External",
    description="Interact with external APIs like Stable Diffusion and RTX Remix",
)

external_stable_diffusion_category = package.add_category(
    name="Stable Diffusion (External)",
    description="Interact with an external Stable Diffusion API",
    icon="FaPaintBrush",
    color="#9331CC",
)

_FEATURE_DESCRIPTION = f"""
ChaiNNer can connect to [AUTOMATIC1111's Stable Diffusion Web UI](https://github.com/AUTOMATIC1111/stable-diffusion-webui) to run Stable Diffusion nodes.

If you want to use the External Stable Diffusion nodes, run the Automatic1111 web UI with the `--api` flag, like so:

```bash
./webui.{"bat" if sys.platform == "win32" else "sh"} --api
```

To manually set where chaiNNer looks for the API, use the `STABLE_DIFFUSION_PROTOCOL`, `STABLE_DIFFUSION_HOST`, and `STABLE_DIFFUSION_PORT` environment variables. By default, `127.0.0.1` will be the host. If not specified, chaiNNer will try to auto-detect the protocol and port.
"""


web_ui_feature_descriptor = package.add_feature(
    id="webui",
    name="AUTOMATIC1111/stable-diffusion-webui",
    description=_FEATURE_DESCRIPTION,
)

external_rtx_remix_category = package.add_category(
    name="RTX Remix (External)",
    description="Interact with NVIDIA RTX Remix REST API",
    icon="SiNvidia",
    color="#76B900",
)

_RTX_REMIX_FEATURE_DESCRIPTION = """
ChaiNNer can connect to [NVIDIA RTX Remix](https://docs.omniverse.nvidia.com/kit/docs/rtx_remix/1.2.4/docs/howto/learning-restapi.html) to interact with RTX Remix runtime via REST API.

If you want to use the RTX Remix nodes, make sure RTX Remix runtime is running with the REST API enabled.

To manually set where chaiNNer looks for the API, use the `RTX_REMIX_PROTOCOL`, `RTX_REMIX_HOST`, and `RTX_REMIX_PORT` environment variables. By default, `127.0.0.1:8111` will be used. If not specified, chaiNNer will try to auto-detect the connection.
"""

rtx_remix_feature_descriptor = package.add_feature(
    id="rtx_remix",
    name="NVIDIA RTX Remix",
    description=_RTX_REMIX_FEATURE_DESCRIPTION,
)

logger.debug("Loaded package %s", package.name)
