from __future__ import annotations

from inspect import isawaitable
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Dict,
    Set,
    Tuple,
    Type,
    get_type_hints,
)

from sanic import Request
from sanic.exceptions import ServerError

from sanic_ext.exceptions import InitError

if TYPE_CHECKING:
    from .registry import InjectionRegistry


class Constructor:
    EXEMPT_ANNOTATIONS = (Request,)

    def __init__(
        self,
        func: Callable[..., Any],
    ):
        self.func = func
        self.injections: Dict[str, Tuple[Type, Constructor]] = {}
        self.pass_kwargs = False

    def __str__(self) -> str:
        return f"<{self.__class__.__name__}:{self.func.__name__}>"

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(func={self.func.__name__})>"

    async def __call__(self, request, **kwargs):
        try:
            args = await gather_args(self.injections, request, **kwargs)
            if self.pass_kwargs:
                args.update(kwargs)
            retval = self.func(request, **args)
            if isawaitable(retval):
                retval = await retval
            return retval
        except TypeError as e:
            raise ServerError(
                "Failure to inject dependencies. Make sure that all "
                f"dependencies for '{self.func.__name__}' have been "
                "registered."
            ) from e

    def prepare(
        self,
        injection_registry: InjectionRegistry,
        allowed_types: Set[Type[object]],
    ) -> None:
        hints = get_type_hints(self.func)
        hints.pop("return", None)
        missing = []
        for param, annotation in hints.items():
            if annotation in allowed_types:
                self.pass_kwargs = True
            if (
                annotation not in self.EXEMPT_ANNOTATIONS
                and annotation not in allowed_types
            ):
                dependency = injection_registry.get(annotation)
                if not dependency:
                    missing.append((param, annotation))
                self.injections[param] = (annotation, dependency)

        if missing:
            dependencies = "\n".join(
                [f"  - {param}: {annotation}" for param, annotation in missing]
            )
            raise InitError(
                "Unable to resolve dependencies for "
                f"'{self.func.__name__}'. Could not find the following "
                f"dependencies:\n{dependencies}.\nMake sure the dependencies "
                "are declared using ext.injection. See "
                "https://sanicframework.org/en/plugins/sanic-ext/injection."
                "html#injecting-services for more details."
            )

        self.check_circular(set())

    def check_circular(
        self,
        checked: Set[Type[object]],
    ) -> None:
        dependencies = set(self.injections.values())
        for dependency, constructor in dependencies:
            if dependency in checked:
                raise InitError(
                    "Circular dependency injection detected on "
                    f"'{self.func.__name__}'. Check dependencies of "
                    f"'{constructor.func.__name__}' which may contain "
                    f"circular dependency chain with {dependency}."
                )
            checked.add(dependency)
            constructor.check_circular(checked)


async def gather_args(injections, request, **kwargs) -> Dict[str, Any]:
    return {
        name: await do_cast(_type, constructor, request, **kwargs)
        for name, (_type, constructor) in injections.items()
    }


async def do_cast(_type, constructor, request, **kwargs):
    cast = constructor if constructor else _type
    args = [request] if constructor else []

    retval = cast(*args, **kwargs)
    if isawaitable(retval):
        retval = await retval
    return retval
