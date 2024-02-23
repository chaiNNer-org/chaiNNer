import sys

from sanic.log import logger

from api import add_package

package = add_package(
    __file__,
    id="chaiNNer_external",
    name="外部",
    description="与外部 Stable Diffusion API 交互",
)

external_stable_diffusion_category = package.add_category(
    name="Stable Diffusion 外部)",
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

logger.debug(f"Loaded package {package.name}")
