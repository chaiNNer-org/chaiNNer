import ast
import sys
import typing as t
from abc import ABC, abstractmethod
from re import Pattern
from types import SimpleNamespace
from warnings import warn

from ..sanic_routing.group import RouteGroup
from .exceptions import BadMethod, FinalizationError, InvalidUsage, NoMethod, NotFound
from .line import Line
from .patterns import REGEX_TYPES
from .route import Route
from .tree import Node, Tree
from .utils import parts_to_path, path_to_parts

# The below functions might be called by the compiled source code, and
# therefore should be made available here by import
import re  # noqa  isort:skip
from datetime import datetime  # noqa  isort:skip
from urllib.parse import unquote  # noqa  isort:skip
from uuid import UUID  # noqa  isort:skip
from .patterns import parse_date, alpha, slug  # noqa  isort:skip


class BaseRouter(ABC):
    DEFAULT_METHOD = "BASE"
    ALLOWED_METHODS: t.Tuple[str, ...] = tuple()

    def __init__(
        self,
        delimiter: str = "/",
        exception: t.Type[NotFound] = NotFound,
        method_handler_exception: t.Type[NoMethod] = NoMethod,
        route_class: t.Type[Route] = Route,
        group_class: t.Type[RouteGroup] = RouteGroup,
        stacking: bool = False,
        cascade_not_found: bool = False,
    ) -> None:
        self._find_route = None
        self._matchers = None
        self.static_routes: t.Dict[t.Tuple[str, ...], RouteGroup] = {}
        self.dynamic_routes: t.Dict[t.Tuple[str, ...], RouteGroup] = {}
        self.regex_routes: t.Dict[t.Tuple[str, ...], RouteGroup] = {}
        self.name_index: t.Dict[str, Route] = {}
        self.delimiter = delimiter
        self.exception = exception
        self.method_handler_exception = method_handler_exception
        self.route_class = route_class
        self.group_class = group_class
        self.tree = Tree(router=self)
        self.finalized = False
        self.stacking = stacking
        self.ctx = SimpleNamespace()
        self.cascade_not_found = cascade_not_found

        self.regex_types = {**REGEX_TYPES}

    @abstractmethod
    def get(self, **kwargs):
        ...

    def resolve(
        self,
        path: str,
        *,
        method: t.Optional[str] = None,
        orig: t.Optional[str] = None,
        extra: t.Optional[t.Dict[str, str]] = None,
    ) -> t.Tuple[Route, t.Callable[..., t.Any], t.Dict[str, t.Any]]:
        try:
            route, param_basket = self.find_route(
                path,
                method,
                self,
                {"__params__": {}, "__matches__": {}},
                extra,
            )
        except (NotFound, NoMethod) as e:
            # If we did not find the route, we might need to try routing one
            # more time to handle strict_slashes
            if path.endswith(self.delimiter):
                return self.resolve(
                    path=path[:-1],
                    method=method,
                    orig=path,
                    extra=extra,
                )
            raise self.exception(str(e), path=path)

        if isinstance(route, RouteGroup):
            try:
                route = route.methods_index[method]
            except KeyError:
                raise self.method_handler_exception(
                    f"Method '{method}' not found on {route}",
                    method=method,
                    allowed_methods=route.methods,
                )

        # Regex routes evaluate and can extract params directly. They are set
        # on param_basket["__params__"]
        params = param_basket["__params__"]
        if not params:
            # If param_basket["__params__"] does not exist, we might have
            # param_basket["__matches__"], which are indexed based matches
            # on path segments. They should already be cast types.
            params = {
                param.name: param_basket["__matches__"][idx]
                for idx, param in route.params.items()
            }

        # Double check that if we made a match it is not a false positive
        # because of strict_slashes
        if route.strict and orig and orig[-1] != route.path[-1]:
            raise self.exception("Path not found", path=path)

        if method not in route.methods:
            raise self.method_handler_exception(
                f"Method '{method}' not found on {route}",
                method=method,
                allowed_methods=route.methods,
            )

        return route, route.handler, params

    def add(
        self,
        path: str,
        handler: t.Callable,
        methods: t.Optional[t.Union[t.Sequence[str], t.FrozenSet[str], str]] = None,
        name: t.Optional[str] = None,
        requirements: t.Optional[t.Dict[str, t.Any]] = None,
        strict: bool = False,
        unquote: bool = False,  # noqa
        overwrite: bool = False,
        append: bool = False,
    ) -> Route:
        # Can add a route with overwrite, or append, not both.
        # - overwrite: if matching path exists, replace it
        # - append: if matching path exists, append handler to it
        if overwrite and append:
            raise FinalizationError(
                "Cannot add a route with both overwrite and append equal " "to True"
            )
        if not methods:
            methods = [self.DEFAULT_METHOD]

        if hasattr(methods, "__iter__") and not isinstance(methods, frozenset):
            methods = frozenset(methods)
        elif isinstance(methods, str):
            methods = frozenset([methods])

        if self.ALLOWED_METHODS and any(
            method not in self.ALLOWED_METHODS for method in methods
        ):
            bad = [method for method in methods if method not in self.ALLOWED_METHODS]
            raise BadMethod(
                f"Bad method: {bad}. Must be one of: {self.ALLOWED_METHODS}"
            )

        if self.finalized:
            raise FinalizationError("Cannot finalize router more than once.")

        static = "<" not in path and requirements is None
        regex = self._is_regex(path)

        # There are generally three pools of routes on the router:
        # - those that are static patterns with not matching
        # - those that have one or more dynamic parts, but NO regex
        # - those that have one or more dynamic parts, with at least one regex
        if regex:
            routes = self.regex_routes
        elif static:
            routes = self.static_routes
        else:
            routes = self.dynamic_routes

        # Only URL encode the static parts of the path
        path = parts_to_path(path_to_parts(path, self.delimiter), self.delimiter)

        # We need to clean off the delimiters are the beginning, and maybe the
        # end, depending upon whether we are in strict mode
        strip = path.lstrip if strict else path.strip
        path = strip(self.delimiter)
        route = self.route_class(
            self,
            path,
            name or "",
            handler=handler,
            methods=methods,
            requirements=requirements,
            strict=strict,
            unquote=unquote,
            static=static,
            regex=regex,
        )
        group = self.group_class(route)

        # Catch the scenario where a route is overloaded with and
        # and without requirements, first as dynamic then as static
        if static and route.segments in self.dynamic_routes:
            routes = self.dynamic_routes

        # Catch the reverse scenario where a route is overload first as static
        # and then as dynamic
        if not static and route.segments in self.static_routes:
            existing_group = self.static_routes.pop(route.segments)
            group.merge(existing_group, overwrite, append)

        else:
            if route.segments in routes:
                existing_group = routes[route.segments]
                group.merge(existing_group, overwrite, append)

            routes[route.segments] = group

        if name:
            self.name_index[name] = route

        group.finalize()

        return route

    def register_pattern(
        self, label: str, cast: t.Callable[[str], t.Any], pattern: Pattern
    ):
        """
        Add a custom parameter type to the router. The cast shoud raise a
        ValueError if it is an incorrect type. The order of registration is
        important if it is possible that a single value could pass multiple
        pattern types. Therefore, patterns are tried in the REVERSE order of
        registration. All custom patterns will be evaluated before any built-in
        patterns.

        :param label: The parts that is used to signify the type: example

        :type label: str
        :param cast: The callable that casts the value to the desired type, or
            fails trying
        :type cast: t.Callable[[str], t.Any]
        :param pattern: A regular expression that could also match the path
            segment
        :type pattern: Pattern
        """
        if not isinstance(label, str):
            raise InvalidUsage(
                "When registering a pattern, label must be a "
                f"string, not label={label}"
            )
        if not callable(cast):
            raise InvalidUsage(
                "When registering a pattern, cast must be a "
                f"callable, not cast={cast}"
            )
        if not isinstance(pattern, str):
            raise InvalidUsage(
                "When registering a pattern, pattern must be a "
                f"string, not pattern={pattern}"
            )

        globals()[cast.__name__] = cast
        self.regex_types[label] = (cast, pattern)

    def finalize(self, do_compile: bool = True, do_optimize: bool = False):
        """
        After all routes are added, we can put everything into a final state
        and build the routing dource

        :param do_compile: Whether to compile the source, mainly a debugging
            tool, defaults to True
        :type do_compile: bool, optional
        :param do_optimize: Experimental feature that uses AST module to make
            some optimizations, defaults to False
        :type do_optimize: bool, optional
        :raises FinalizationError: Cannot finalize if there are no routes, or
            the router has already been finalized (can call reset() to undo it)
        """
        if self.finalized:
            raise FinalizationError("Cannot finalize router more than once.")
        if not self.routes:
            raise FinalizationError("Cannot finalize with no routes defined.")
        self.finalized = True

        for group in (
            list(self.static_routes.values())
            + list(self.dynamic_routes.values())
            + list(self.regex_routes.values())
        ):
            group.finalize()
            for route in group.routes:
                route.finalize()

        # Evaluates all of the paths and arranges them into a hierarchichal
        # tree of nodes
        self._generate_tree()

        # Renders the source code
        self._render(do_compile, do_optimize)

    def reset(self):
        self.finalized = False
        self.tree = Tree(router=self)
        self._find_route = None

        for group in (
            list(self.static_routes.values())
            + list(self.dynamic_routes.values())
            + list(self.regex_routes.values())
        ):
            group.reset()
            for route in group.routes:
                route.reset()

    def _get_non_static_non_path_groups(
        self, has_dynamic_path: bool
    ) -> t.List[RouteGroup]:
        """
        Paths that have some matching params (includes dynamic and regex),
        but excludes any routes with a <path:path> or delimiter in its regex.
        This is because those special cases need to be evaluated seperately.
        Anything else can be evaluated in the node tree.

        :param has_dynamic_path: Whether the path catches a path, or path-like
        type
        :type has_dynamic_path: bool
        :return: list of routes that have no path, but do need matching
        :rtype: List[RouteGroup]
        """
        return sorted(
            [
                group
                for group in list(self.dynamic_routes.values())
                + list(self.regex_routes.values())
                if group.dynamic_path is has_dynamic_path
            ],
            key=lambda x: x.depth,
            reverse=True,
        )

    def _generate_tree(self) -> None:
        self.tree.generate(self._get_non_static_non_path_groups(False))
        self.tree.finalize()

    def _render(self, do_compile: bool = True, do_optimize: bool = False) -> None:
        # Initial boilerplate for the function source
        src = [
            Line("def find_route(path, method, router, basket, extra):", 0),
            Line("parts = tuple(path[1:].split(router.delimiter))", 1),
        ]
        delayed = []

        # Add static path matching
        if self.static_routes:
            # TODO:
            # - future improvement would be to decide which option to use
            #   at runtime based upon the makeup of the router since this
            #   potentially has an impact on performance
            src += [
                Line("try:", 1),
                Line(
                    "group = router.static_routes[parts]",
                    2,
                ),
                Line("basket['__raw_path__'] = path", 2),
                Line("return group, basket", 2),
                Line("except KeyError:", 1),
                Line("pass", 2),
            ]
            # src += [
            #     Line("if parts in router.static_routes:", 1),
            #     Line("route = router.static_routes[parts]", 2),
            #     Line("basket['__raw_path__'] = route.path", 2),
            #     Line("return route, basket", 2),
            # ]
            # src += [
            #     Line("if path in router.static_routes:", 1),
            #     Line("route = router.static_routes.get(path)", 2),
            #     Line("basket['__raw_path__'] = route.path", 2),
            #     Line("return route, basket", 2),
            # ]

        # Add in pre-compiled regular expressions so they do not need to
        # compile at run time
        if self.regex_routes:
            routes = sorted(
                self.regex_routes.values(),
                key=lambda route: len(route.parts),
                reverse=True,
            )
            delayed.append(Line("matchers = [", 0))
            for idx, group in enumerate(routes):
                group.pattern_idx = idx
                delayed.append(Line(f"re.compile(r'^{group.pattern}$'),", 1))
            delayed.append(Line("]", 0))

        # Generate all the dynamic code
        if self.dynamic_routes or self.regex_routes:
            src += [Line("num = len(parts)", 1)]
            src += self.tree.render()

        # Inject regex matching that could not be in the tree
        for group in self._get_non_static_non_path_groups(True):
            route_container = "regex_routes" if group.regex else "dynamic_routes"
            route_idx: t.Union[str, int] = 0
            holder: t.List[Line] = []

            if len(group.routes) > 1:
                route_idx = "route_idx"
                Node._inject_method_check(holder, 2, group)

            src.extend(
                [
                    Line(
                        (
                            "match = router.matchers"
                            f"[{group.pattern_idx}].match(path)"
                        ),
                        1,
                    ),
                    Line("if match:", 1),
                    *holder,
                    Line("basket['__params__'] = match.groupdict()", 2),
                    Line(
                        (
                            f"return router.{route_container}"
                            f"[{group.segments}][{route_idx}], basket"
                        ),
                        2,
                    ),
                ]
            )

        src.append(Line("raise NotFound", 1))
        src.extend(delayed)

        self.find_route_src = "".join(map(str, filter(lambda x: x.render, src)))
        if do_compile:
            try:
                syntax_tree = ast.parse(self.find_route_src)

                if do_optimize:
                    self._optimize(syntax_tree.body[0])

                if sys.version_info.major == 3 and sys.version_info.minor >= 9:
                    # This is purely a convenience thing. Python 3.9 added this
                    # feature, so it allows us to see exactly how the
                    # interpreter will see the code after compiling and any
                    # optimizing.
                    setattr(
                        self,
                        "find_route_src_compiled",
                        ast.unparse(syntax_tree),  # type: ignore
                    )

                # Sometimes there may be missing meta data, so we add it back
                # before compiling
                ast.fix_missing_locations(syntax_tree)

                compiled_src = compile(
                    syntax_tree,
                    "",
                    "exec",
                )
            except SyntaxError as se:
                syntax_error = (
                    f"Line {se.lineno}: {se.msg}\n{se.text}"
                    f"{' '*max(0,int(se.offset or 0)-1) + '^'}"
                )
                raise FinalizationError(
                    f"Cannot compile route AST:\n{self.find_route_src}"
                    f"\n{syntax_error}"
                )
            ctx: t.Dict[t.Any, t.Any] = {}
            exec(compiled_src, None, ctx)
            self._find_route = ctx["find_route"]
            self._matchers = ctx.get("matchers")

    @property
    def find_route(self):
        return self._find_route

    @property
    def matchers(self):
        return self._matchers

    @property
    def groups(self):
        return {
            **self.static_routes,
            **self.dynamic_routes,
            **self.regex_routes,
        }

    @property
    def routes(self):
        return tuple([route for group in self.groups.values() for route in group])

    def _optimize(self, node) -> None:
        warn(
            "Router AST optimization is an experimental only feature. "
            "Results may vary from unoptimized code."
        )
        if hasattr(node, "body"):
            for child in node.body:
                self._optimize(child)

            # concatenate nested single if blocks
            # EXAMPLE:
            #      if parts[1] == "foo":
            #          if num > 3:
            # BECOMES:
            #       if parts[1] == 'foo' and num > 3:
            # Testing has shown that further recursion does not actually
            # produce any faster results.
            if self._is_lone_if(node) and self._is_lone_if(node.body[0]):
                current = node.body[0]
                nested = node.body[0].body[0]

                values: t.List[t.Any] = []
                for test in [current.test, nested.test]:
                    if isinstance(test, ast.Compare):
                        values.append(test)
                    elif isinstance(test, ast.BoolOp) and isinstance(test.op, ast.And):
                        values.extend(test.values)
                    else:
                        ...
                combined = ast.BoolOp(op=ast.And(), values=values)

                current.test = combined
                current.body = nested.body

            # Look for identical successive if blocks
            # EXAMPLE:
            #       if num == 5:
            #           foo1()
            #       if num == 5:
            #           foo2()
            # BECOMES:
            #       if num == 5:
            #           foo1()
            #           foo2()
            if (
                all(isinstance(child, ast.If) for child in node.body)
                # TODO: create func to peoperly compare equality of conditions
                # and len({child.test for child in node.body})
                and len(node.body) > 1
            ):
                first, *rem = node.body
                for item in rem:
                    first.body.extend(item.body)

                node.body = [first]

        if hasattr(node, "orelse"):
            for child in node.orelse:
                self._optimize(child)

    @staticmethod
    def _is_lone_if(node):
        return len(node.body) == 1 and isinstance(node.body[0], ast.If)

    def _is_regex(self, path: str):
        parts = path_to_parts(path, self.delimiter)

        def requires(part):
            if not part.startswith("<") or ":" not in part:
                return False

            _, pattern_type = part[1:-1].split(":", 1)

            return (
                part.endswith(":path>")
                or self.delimiter in part
                or pattern_type not in self.regex_types
            )

        return any(requires(part) for part in parts)
