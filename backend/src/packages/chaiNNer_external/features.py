from . import web_ui_feature_descriptor
from .web_ui import check_connection

web_ui = web_ui_feature_descriptor.add_behavior(check=check_connection)
