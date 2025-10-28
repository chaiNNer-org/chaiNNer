from api import FeatureState
from nodes.utils.format import join_english

from . import rtx_remix_feature_descriptor, web_ui_feature_descriptor
from .rtx_remix_api import (
    RemixApiConfig,
)
from .rtx_remix_api import (
    get_verified_api as get_verified_remix_api,
)
from .web_ui import ApiConfig, get_verified_api


async def check_connection() -> FeatureState:
    config = None
    try:
        config = ApiConfig.from_env()
        api = await get_verified_api()
        if api is not None:
            return FeatureState.enabled(f"Connected to {api.base_url}")
        else:
            url = config.host
            if len(config.protocol) == 1:
                url = f"{config.protocol[0]}://{url}"
            if len(config.port) == 1:
                url += f":{config.port[0]}"
            else:
                ports = join_english(config.port)
                url += f" on ports {ports}"

            return FeatureState.disabled(
                f"No stable diffusion API found. Could not connect to {url}."
            )
    except Exception as e:
        return FeatureState.disabled(f"Could not connect to stable diffusion API: {e}")


web_ui = web_ui_feature_descriptor.add_behavior(check=check_connection)


async def check_remix_connection() -> FeatureState:
    config = None
    try:
        config = RemixApiConfig.from_env()
        api = await get_verified_remix_api()
        if api is not None:
            return FeatureState.enabled(f"Connected to {api.base_url}")
        else:
            url = config.host
            if len(config.protocol) == 1:
                url = f"{config.protocol[0]}://{url}"
            if len(config.port) == 1:
                url += f":{config.port[0]}"
            else:
                ports = join_english(config.port)
                url += f" on ports {ports}"

            return FeatureState.disabled(
                f"No RTX Remix API found. Could not connect to {url}."
            )
    except Exception as e:
        return FeatureState.disabled(f"Could not connect to RTX Remix API: {e}")


rtx_remix = rtx_remix_feature_descriptor.add_behavior(check=check_remix_connection)
