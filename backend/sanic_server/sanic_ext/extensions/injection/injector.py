from __future__ import annotations

from inspect import getmembers, isclass, isfunction
from typing import Any, Callable, Dict, Optional, Tuple, Type, get_type_hints

from sanic import Sanic
from sanic.constants import HTTP_METHODS

from sanic_ext.extensions.injection.constructor import gather_args

from .registry import InjectionRegistry, SignatureRegistry


def add_injection(app: Sanic, injection_registry: InjectionRegistry) -> None:
    signature_registry = _setup_signature_registry(app, injection_registry)

    @app.after_server_start
    async def finalize_injections(app: Sanic, _):
        router_converters = set(
            allowed[0] for allowed in app.router.regex_types.values()
        )
        router_types = set()
        for converter in router_converters:
            if isclass(converter):
                router_types.add(converter)
            elif isfunction(converter):
                hints = get_type_hints(converter)
                if return_type := hints.get("return"):
                    router_types.add(return_type)
        injection_registry.finalize(router_types)

    @app.signal("http.routing.after")
    async def inject_kwargs(request, route, kwargs, **_):
        nonlocal signature_registry

        for name in (route.name, f"{route.name}_{request.method.lower()}"):
            injections = signature_registry.get(name)
            if injections:
                break

        if injections:
            injected_args = await gather_args(injections, request, **kwargs)
            request.match_info.update(injected_args)


def _http_method_predicate(member):
    return isfunction(member) and member.__name__ in HTTP_METHODS


def _setup_signature_registry(
    app: Sanic,
    injection_registry: InjectionRegistry,
) -> SignatureRegistry:
    registry = SignatureRegistry()

    @app.after_server_start
    async def setup_signatures(app, _):
        nonlocal registry

        for route in app.router.routes:
            handlers = [(route.name, route.handler)]
            viewclass = getattr(route.handler, "view_class", None)
            if viewclass:
                handlers = [
                    (f"{route.name}_{name}", member)
                    for name, member in getmembers(
                        viewclass, _http_method_predicate
                    )
                ]
            for name, handler in handlers:
                try:
                    hints = get_type_hints(handler)
                except TypeError:
                    continue

                injections: Dict[
                    str, Tuple[Type, Optional[Callable[..., Any]]]
                ] = {
                    param: (
                        annotation,
                        injection_registry[annotation],
                    )
                    for param, annotation in hints.items()
                    if annotation in injection_registry
                }
                registry.register(name, injections)

    return registry
