import re
import typing as t
from collections import namedtuple
from types import SimpleNamespace
from warnings import warn

from .exceptions import InvalidUsage, ParameterNameConflicts
from .utils import Immutable, parts_to_path, path_to_parts

ParamInfo = namedtuple(
    "ParamInfo",
    ("name", "raw_path", "label", "cast", "pattern", "regex", "priority"),
)


class Requirements(Immutable):
    def __hash__(self):
        return hash(frozenset(self.items()))


class Route:
    __slots__ = (
        "_params",
        "_raw_path",
        "ctx",
        "handler",
        "labels",
        "methods",
        "name",
        "overloaded",
        "params",
        "parts",
        "path",
        "pattern",
        "regex",
        "requirements",
        "router",
        "static",
        "strict",
        "unquote",
    )

    #: A container for route meta-data
    ctx: SimpleNamespace
    #: The route handler
    handler: t.Callable[..., t.Any]
    #: The HTTP methods that the route can handle
    methods: t.FrozenSet[str]
    #: The route name, either generated or as defined in the route definition
    name: str
    #: The raw version of the path exploded (see also
    #: :py:attr:`~sanic_routing.route.Route.segments`)
    parts: t.Tuple[str, ...]
    #: The _reconstructed_ path after the Route has been normalized.
    #: Does not contain preceding ``/``  (see also
    #: :py:attr:`~sanic_routing.route.Route.uri`)
    path: str
    #: A regex version of the :py:attr:`~sanic_routing.route.Route.path`
    pattern: t.Optional[str]
    #: Whether the route requires regular expression evaluation
    regex: bool
    #: A representation of the non-path route requirements
    requirements: Requirements
    #: When ``True``, the route does not have any dynamic path parameters
    static: bool
    #: Whether the route should be matched with strict evaluation
    strict: bool
    #: Whether the route should be unquoted after matching if (for example) it
    #: is suspected to contain non-URL friendly characters
    unquote: bool

    def __init__(
        self,
        router,
        raw_path: str,
        name: str,
        handler: t.Callable[..., t.Any],
        methods: t.Union[t.Sequence[str], t.FrozenSet[str]],
        requirements: t.Dict[str, t.Any] = None,
        strict: bool = False,
        unquote: bool = False,
        static: bool = False,
        regex: bool = False,
        overloaded: bool = False,
    ):
        self.router = router
        self.name = name
        self.handler = handler  # type: ignore
        self.methods = frozenset(methods)
        self.requirements = Requirements(requirements or {})

        self.ctx = SimpleNamespace()

        self._params: t.Dict[int, ParamInfo] = {}
        self._raw_path = raw_path

        # Main goal is to do some normalization. Any dynamic segments
        # that are missing a type are rewritten with str type
        ingested_path = self._ingest_path(raw_path)

        # By passing the path back and forth to deconstruct and reconstruct
        # we can normalize it and make sure we are dealing consistently
        parts = path_to_parts(ingested_path, self.router.delimiter)
        self.path = parts_to_path(parts, delimiter=self.router.delimiter)
        self.parts = parts
        self.static = static
        self.regex = regex
        self.overloaded = overloaded
        self.pattern = None
        self.strict: bool = strict
        self.unquote: bool = unquote
        self.labels: t.Optional[t.List[str]] = None

        self._setup_params()

    def __str__(self):
        display = (
            f"name={self.name} path={self.path or self.router.delimiter}"
            if self.name and self.name != self.path
            else f"path={self.path or self.router.delimiter}"
        )
        return f"<{self.__class__.__name__}: {display}>"

    def __repr__(self) -> str:
        return str(self)

    def __eq__(self, other) -> bool:
        if not isinstance(other, self.__class__):
            return False

        # Equality specifically uses self.segments and not self.parts.
        # In general, these properties are nearly identical.
        # self.segments is generalized and only displays dynamic param types
        # and self.parts has both the param key and the param type.
        # In this test, we use the & operator so that we create a union and a
        # positive equality if there is one or more overlaps in the methods.
        return bool(
            (
                self.segments,
                self.requirements,
            )
            == (
                other.segments,
                other.requirements,
            )
            and (self.methods & other.methods)
        )

    def _ingest_path(self, path):
        segments = []
        for part in path.split(self.router.delimiter):
            if part.startswith("<") and ":" not in part:
                name = part[1:-1]
                part = f"<{name}:str>"
            segments.append(part)
        return self.router.delimiter.join(segments)

    def _setup_params(self):
        key_path = parts_to_path(
            path_to_parts(self.raw_path, self.router.delimiter),
            self.router.delimiter,
        )
        if not self.static:
            parts = path_to_parts(key_path, self.router.delimiter)
            for idx, part in enumerate(parts):
                if part.startswith("<"):
                    (
                        name,
                        label,
                        _type,
                        pattern,
                    ) = self.parse_parameter_string(part[1:-1])
                    self.add_parameter(
                        idx, name, key_path, label, _type, pattern
                    )

    def add_parameter(
        self,
        idx: int,
        name: str,
        raw_path: str,
        label: str,
        cast: t.Type,
        pattern=None,
    ):
        if pattern and isinstance(pattern, str):
            if not pattern.startswith("^"):
                pattern = f"^{pattern}"
            if not pattern.endswith("$"):
                pattern = f"{pattern}$"

            pattern = re.compile(pattern)

        is_regex = label not in self.router.regex_types
        priority = (
            0
            if is_regex
            else list(self.router.regex_types.keys()).index(label)
        )
        self._params[idx] = ParamInfo(
            name, raw_path, label, cast, pattern, is_regex, priority
        )

    def _finalize_params(self):
        params = dict(self._params)
        label_pairs = set([(param.name, idx) for idx, param in params.items()])
        labels = [item[0] for item in label_pairs]
        if len(labels) != len(set(labels)):
            raise ParameterNameConflicts(
                f"Duplicate named parameters in: {self._raw_path}"
            )
        self.labels = labels
        self.params = dict(
            sorted(params.items(), key=lambda param: self._sorting(param[1]))
        )

    def _compile_regex(self):
        components = []

        for part in self.parts:
            if part.startswith("<"):
                name, *_, pattern = self.parse_parameter_string(part)
                if not isinstance(pattern, str):
                    pattern = pattern.pattern.strip("^$")
                compiled = re.compile(pattern)
                if compiled.groups == 1:
                    if compiled.groupindex:
                        if list(compiled.groupindex)[0] != name:
                            raise InvalidUsage(
                                f"Named group ({list(compiled.groupindex)[0]})"
                                f" must match your named parameter ({name})"
                            )
                        components.append(pattern)
                    else:
                        if pattern.count("(") > 1:
                            raise InvalidUsage(
                                f"Could not compile pattern {pattern}. "
                                "Try using a named group instead: "
                                f"'(?P<{name}>your_matching_group)'"
                            )
                        beginning, end = pattern.split("(")
                        components.append(f"{beginning}(?P<{name}>{end}")
                elif compiled.groups > 1:
                    raise InvalidUsage(f"Invalid matching pattern {pattern}")
                else:
                    components.append(f"(?P<{name}>{pattern})")
            else:
                components.append(part)

        self.pattern = self.router.delimiter + self.router.delimiter.join(
            components
        )

    def finalize(self):
        self._finalize_params()
        if self.regex:
            self._compile_regex()
        self.requirements = Immutable(self.requirements)

    def reset(self):
        self.requirements = dict(self.requirements)

    @property
    def defined_params(self):
        return self._params

    @property
    def raw_path(self):
        """
        The raw path from the route definition
        """
        return self._raw_path

    @property
    def segments(self) -> t.Tuple[str, ...]:
        """
        Same as :py:attr:`~sanic_routing.route.Route.parts` except
        generalized so that any dynamic parts do not
        include param keys since they have no impact on routing.
        """
        return tuple(
            f"<__dynamic__:{self._params[idx].label}>"
            if idx in self._params
            else segment
            for idx, segment in enumerate(self.parts)
        )

    @property
    def uri(self):
        """
        Since :py:attr:`~sanic_routing.route.Route.path` does NOT
        include a preceding '/', this adds it back.
        """
        return f"{self.router.delimiter}{self.path}"

    def _sorting(self, item) -> int:
        try:
            return list(self.router.regex_types.keys()).index(item.label)
        except ValueError:
            return len(list(self.router.regex_types.keys()))

    def parse_parameter_string(self, parameter_string: str):
        """Parse a parameter string into its constituent name, type, and
        pattern

        For example::

            parse_parameter_string('<param_one:[A-z]>')` ->
                ('param_one', '[A-z]', <class 'str'>, '[A-z]')

        :param parameter_string: String to parse
        :return: tuple containing
            (parameter_name, parameter_type, parameter_pattern)
        """
        # We could receive NAME or NAME:PATTERN
        parameter_string = parameter_string.strip("<>")
        name = parameter_string
        label = "str"
        if ":" in parameter_string:
            name, label = parameter_string.split(":", 1)
            if not name:
                raise ValueError(
                    f"Invalid parameter syntax: {parameter_string}"
                )
            if label == "string":
                warn(
                    "Use of 'string' as a path parameter type is deprected, "
                    "and will be removed in Sanic v21.12. "
                    f"Instead, use <{name}:str>.",
                    DeprecationWarning,
                )
            elif label == "number":
                warn(
                    "Use of 'number' as a path parameter type is deprected, "
                    "and will be removed in Sanic v21.12. "
                    f"Instead, use <{name}:float>.",
                    DeprecationWarning,
                )

        default = (str, label)
        # Pull from pre-configured types
        _type, pattern = self.router.regex_types.get(label, default)
        return name, label, _type, pattern
