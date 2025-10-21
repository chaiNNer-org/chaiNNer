from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, TypedDict, Union

from logger import get_logger_from_env

logger = get_logger_from_env()

SettingsJson = Dict[str, object]
JsonExecutionOptions = Dict[str, SettingsJson]


class ExecutionOptions:
    def __init__(
        self,
        backend_settings: JsonExecutionOptions,
    ) -> None:
        self.__settings = backend_settings
        self.__parsers: dict[str, SettingsParser] = {}

        logger.info("Execution options: %s", self.__settings)

    @staticmethod
    def parse(json: JsonExecutionOptions) -> ExecutionOptions:
        return ExecutionOptions(backend_settings=json)

    def get_package_settings_json(self, package_id: str) -> SettingsJson:
        return self.__settings.get(package_id, {})

    def get_package_settings(self, package_id: str) -> SettingsParser:
        parser = self.__parsers.get(package_id)
        if parser is None:
            parser = SettingsParser(self.get_package_settings_json(package_id))
            self.__parsers[package_id] = parser
        return parser


class SettingsParser:
    def __init__(self, raw: SettingsJson) -> None:
        self.__settings = raw

    def get_bool(self, key: str, default: bool) -> bool:
        value = self.__settings.get(key, default)
        if isinstance(value, bool):
            return value
        raise ValueError(f"Invalid bool value for {key}: {value}")

    def get_int(self, key: str, default: int, parse_str: bool = False) -> int:
        value = self.__settings.get(key, default)
        if parse_str and isinstance(value, str):
            return int(value)
        if isinstance(value, int) and not isinstance(value, bool):
            return value
        raise ValueError(f"Invalid str value for {key}: {value}")

    def get_str(self, key: str, default: str) -> str:
        value = self.__settings.get(key, default)
        if isinstance(value, str):
            return value
        raise ValueError(f"Invalid str value for {key}: {value}")

    def get_cache_location(self, key: str) -> str | None:
        value = self.__settings.get(key)
        if isinstance(value, str) or value is None:
            return value or None
        raise ValueError(f"Invalid cache location value for {key}: {value}")


@dataclass
class ToggleSetting:
    label: str
    key: str
    description: str
    default: bool = False
    disabled: bool = False
    type: str = "toggle"


class DropdownOption(TypedDict):
    label: str
    value: str


@dataclass
class DropdownSetting:
    label: str
    key: str
    description: str
    options: list[DropdownOption]
    default: str
    disabled: bool = False
    type: str = "dropdown"


@dataclass
class NumberSetting:
    label: str
    key: str
    description: str
    min: float
    max: float
    default: float = 0
    disabled: bool = False
    type: str = "number"


@dataclass
class CacheSetting:
    label: str
    key: str
    description: str
    directory: str
    default: str = ""
    disabled: bool = False
    type: str = "cache"


Setting = Union[ToggleSetting, DropdownSetting, NumberSetting, CacheSetting]
