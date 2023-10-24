from dataclasses import dataclass
from typing import Any

from api2 import SettingsParser, get_execution_options


@dataclass(frozen=True)
class GeneralSettings:
    example: bool


def get_global_settings() -> Any:
    settings = SettingsParser(get_execution_options().get_package_settings("general"))

    return GeneralSettings(
        example=settings.get_bool("example", default=False),
    )
