from __future__ import annotations

from typing import FrozenSet, List, Optional, Sequence, Tuple

from ..sanic_routing.route import Requirements, Route
from ..sanic_routing.utils import Immutable
from .exceptions import InvalidUsage, RouteExists


class RouteGroup:
    methods_index: Immutable
    passthru_properties = (
        "labels",
        "params",
        "parts",
        "path",
        "pattern",
        "raw_path",
        "regex",
        "router",
        "segments",
        "strict",
        "unquote",
        "uri",
    )

    #: The _reconstructed_ path after the Route has been normalized.
    #: Does not contain preceding ``/``  (see also
    #: :py:attr:`uri`)
    path: str

    #: A regex version of the :py:attr:`~sanic_routing.route.Route.path`
    pattern: Optional[str]

    #: Whether the route requires regular expression evaluation
    regex: bool

    #: The raw version of the path exploded (see also
    #: :py:attr:`segments`)
    parts: Tuple[str, ...]

    #: Same as :py:attr:`parts` except
    #:  generalized so that any dynamic parts do not
    #:  include param keys since they have no impact on routing.
    segments: Tuple[str, ...]

    #: Whether the route should be matched with strict evaluation
    strict: bool

    #: Whether the route should be unquoted after matching if (for example) it
    #: is suspected to contain non-URL friendly characters
    unquote: bool

    #: Since :py:attr:`path` does NOT
    #:  include a preceding '/', this adds it back.
    uri: str

    def __init__(self, *routes) -> None:
        if len(set(route.parts for route in routes)) > 1:
            raise InvalidUsage("Cannot group routes with differing paths")

        if any(routes[-1].strict != route.strict for route in routes):
            raise InvalidUsage("Cannot group routes with differing strictness")

        route_list = list(routes)
        route_list.pop()

        self._routes = routes
        self.pattern_idx = 0

    def __str__(self):
        display = (
            f"path={self.path or self.router.delimiter} len={len(self.routes)}"
        )
        return f"<{self.__class__.__name__}: {display}>"

    def __repr__(self) -> str:
        return str(self)

    def __iter__(self):
        return iter(self.routes)

    def __getitem__(self, key):
        return self.routes[key]

    def __getattr__(self, key):
        # There are a number of properties that all of the routes in the group
        # share in common. We pass thrm through to make them available
        # on the RouteGroup, and then cache them so that they are permanent.
        if key in self.passthru_properties:
            value = getattr(self[0], key)
            setattr(self, key, value)
            return value

        raise AttributeError(f"RouteGroup has no '{key}' attribute")

    def finalize(self):
        self.methods_index = Immutable(
            {
                method: route
                for route in self._routes
                for method in route.methods
            }
        )

    def reset(self):
        self.methods_index = dict(self.methods_index)

    def merge(
        self, group: RouteGroup, overwrite: bool = False, append: bool = False
    ) -> None:
        """
        The purpose of merge is to group routes with the same path, but
        declarared individually. In other words to group these:

        .. code-block:: python

            @app.get("/path/to")
            def handler1(...):
                ...

            @app.post("/path/to")
            def handler2(...):
                ...

        The other main purpose is to look for conflicts and
        raise ``RouteExists``

        A duplicate route is when:
        1. They have the same path and any overlapping methods; AND
        2. If they have requirements, they are the same

        :param group: Incoming route group
        :type group: RouteGroup
        :param overwrite: whether to allow an otherwise duplicate route group
            to overwrite the existing, if ``True`` will not raise exception
            on duplicates, defaults to False
        :type overwrite: bool, optional
        :param append: whether to allow an otherwise duplicate route group to
            append its routes to the existing route group, defaults to False
        :type append: bool, optional
        :raises RouteExists: Raised when there is a duplicate
        """
        _routes = list(self._routes)
        for other_route in group.routes:
            for current_route in self:
                if (
                    current_route == other_route
                    or (
                        current_route.requirements
                        and not other_route.requirements
                    )
                    or (
                        not current_route.requirements
                        and other_route.requirements
                    )
                ) and not append:
                    if not overwrite:
                        raise RouteExists(
                            f"Route already registered: {self.raw_path} "
                            f"[{','.join(self.methods)}]"
                        )
                else:
                    _routes.append(other_route)
        self._routes = tuple(_routes)

    @property
    def depth(self) -> int:
        """
        The number of parts in :py:attr:`parts`
        """
        return len(self[0].parts)

    @property
    def dynamic_path(self) -> bool:
        return any(
            (param.label == "path") or ("/" in param.label)
            for param in self.params.values()
        )

    @property
    def methods(self) -> FrozenSet[str]:
        """"""
        return frozenset(
            [method for route in self for method in route.methods]
        )

    @property
    def routes(self) -> Sequence[Route]:
        return self._routes

    @property
    def requirements(self) -> List[Requirements]:
        return [route.requirements for route in self if route.requirements]
