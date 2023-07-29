from api import FeatureState

from . import web_ui_feature_descriptor
from .web_ui import get_verified_api


async def check_connection() -> FeatureState:
    try:
        api = await get_verified_api()
        return FeatureState.enabled(f"Connected to {api.base_url}")
    except Exception as e:
        return FeatureState.disabled(f"Could not connect to stable diffusion API: {e}")


web_ui = web_ui_feature_descriptor.add_behavior(check=check_connection)
