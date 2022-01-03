from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Type

from ...sanic.app import Sanic
from ...sanic.exceptions import SanicException
from ...sanic_ext.config import Config
from ...sanic_ext.exceptions import InitError


class NoDuplicateDict(dict):  # type: ignore
    def __setitem__(self, key: Any, value: Any) -> None:
        if key in self:
            raise KeyError(f"Duplicate key: {key}")
        return super().__setitem__(key, value)


class Extension(ABC):
    _name_registry: Dict[str, Type[Extension]] = NoDuplicateDict()
    _singleton = None
    name: str

    def __new__(cls, *args, **kwargs):
        if cls._singleton is None:
            cls._singleton = super().__new__(cls)
            cls._singleton._started = False
        return cls._singleton

    def __init_subclass__(cls):
        if not getattr(cls, "name", None) or not cls.name.isalpha():
            raise InitError(
                "Extensions must be named, and may only contain "
                "alphabetic characters"
            )

        if cls.name in cls._name_registry:
            raise InitError(f'Extension "{cls.name}" already exists')

        cls._name_registry[cls.name] = cls

    def __init__(self, app: Sanic, config: Config) -> None:
        self.app = app
        self.config = config

    def _startup(self, bootstrap):
        if self._started:
            raise SanicException(
                "Extension already started. Cannot start "
                f"Extension:{self.name} multiple times."
            )
        self.startup(bootstrap)
        self._started = True

    @abstractmethod
    def startup(self, bootstrap) -> None:
        ...

    def label(self):
        return ""
