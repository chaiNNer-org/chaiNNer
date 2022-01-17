from typing import Any, Callable, Dict, Optional, Tuple, Type

from .constructor import Constructor


class InjectionRegistry:
    def __init__(self):
        self._registry: Dict[Type, Optional[Callable[..., Any]]] = {}

    def __getitem__(self, key):
        return self._registry[key]

    def __str__(self) -> str:
        return str(self._registry)

    def __contains__(self, other: Any):
        return other in self._registry

    def get(self, key, default=None):
        return self._registry.get(key, default)

    def register(
        self, _type: Type, constructor: Optional[Callable[..., Any]]
    ) -> None:
        if constructor:
            constructor = Constructor(constructor)
        self._registry[_type] = constructor

    def finalize(self, allowed_types):
        for constructor in self._registry.values():
            if isinstance(constructor, Constructor):
                constructor.prepare(self, allowed_types)

    @property
    def length(self):
        return len(self._registry)


class SignatureRegistry:
    def __init__(self):
        self._registry: Dict[
            str, Dict[str, Tuple[Type, Optional[Callable[..., Any]]]]
        ] = {}

    def __getitem__(self, key):
        return self._registry[key]

    def __str__(self) -> str:
        return str(self._registry)

    def get(self, key, default=None):
        return self._registry.get(key, default)

    def register(
        self,
        route_name: str,
        injections: Dict[str, Tuple[Type, Optional[Callable[..., Any]]]],
    ) -> None:
        self._registry[route_name] = injections
