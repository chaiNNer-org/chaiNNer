import typing as t
from logging import getLogger

from .group import RouteGroup
from .line import Line
from .patterns import REGEX_PARAM_NAME

logger = getLogger("sanic.root")


class Node:
    def __init__(
        self,
        part: str = "",
        root: bool = False,
        parent=None,
        router=None,
        param=None,
    ) -> None:
        self.root = root
        self.part = part
        self.parent = parent
        self.param = param
        self._children: t.Dict[str, "Node"] = {}
        self.children: t.Dict[str, "Node"] = {}
        self.level = 0
        self.base_indent = 0
        self.offset = 0
        self.groups: t.List[RouteGroup] = []
        self.dynamic = False
        self.first = False
        self.last = False
        self.children_basketed = False
        self.children_param_injected = False
        self.has_deferred = False
        self.equality_check = False
        self.unquote = False
        self.router = router

    def __str__(self) -> str:
        internals = ", ".join(
            f"{prop}={getattr(self, prop)}"
            for prop in ["part", "level", "groups", "dynamic"]
            if getattr(self, prop) or prop in ["level"]
        )
        return f"<Node: {internals}>"

    def __repr__(self) -> str:
        return str(self)

    @property
    def ident(self) -> str:
        prefix = (
            f"{self.parent.ident}."
            if self.parent and not self.parent.root
            else ""
        )
        return f"{prefix}{self.idx}"

    @property
    def idx(self) -> int:
        if not self.parent:
            return 1
        return list(self.parent.children.keys()).index(self.part) + 1

    def finalize_children(self):
        """
        Sort the children (if any), and set properties for easy checking
        # they are at the beginning or end of the line.
        """
        self.children = {
            k: v for k, v in sorted(self._children.items(), key=self._sorting)
        }
        if self.children:
            keys = list(self.children.keys())
            self.children[keys[0]].first = True
            self.children[keys[-1]].last = True

            for child in self.children.values():
                child.finalize_children()

    def display(self) -> None:
        """
        Visual display of the tree of nodes
        """
        logger.info(" " * 4 * self.level + str(self))
        for child in self.children.values():
            child.display()

    def render(self) -> t.Tuple[t.List[Line], t.List[Line]]:
        # output - code injected into the source as it is being
        #    called/evaluated
        # delayed - code that is injected after you do all of its children
        #    first
        # final - code that is injected at the very end of all rendering
        src: t.List[Line] = []
        delayed: t.List[Line] = []
        final: t.List[Line] = []

        if not self.root:
            src, delayed, final = self.to_src()
        for child in self.children.values():
            o, f = child.render()
            src += o
            final += f
        return src + delayed, final

    def to_src(self) -> t.Tuple[t.List[Line], t.List[Line], t.List[Line]]:
        siblings = self.parent.children if self.parent else {}
        first_sibling: t.Optional[Node] = None

        if not self.first:
            first_sibling = next(iter(siblings.values()))

        self.base_indent = (
            bool(self.level >= 1 or self.first) + self.parent.base_indent
            if self.parent
            else 0
        )

        indent = self.base_indent

        # See render() docstring for definition of these three sequences
        delayed: t.List[Line] = []
        final: t.List[Line] = []
        src: t.List[Line] = []

        # Some cleanup to make code easier to read
        src.append(Line("", indent))
        src.append(Line(f"# node={self.ident} // part={self.part}", indent))

        level = self.level
        idx = level - 1

        return_bump = not self.dynamic

        operation = ">"
        conditional = "if"

        # The "equality_check" is when we do a "==" operation to check
        # that the incoming path is the same length as a particular target.
        # Since this could take place in a few different locations, we need
        # to be able to track if it has been set.
        if self.groups:
            operation = "==" if self.level == self.parent.depth else ">="
            self.equality_check = operation == "=="

        src.append(
            Line(
                f"{conditional} num {operation} {level}:  # CHECK 1",
                indent,
            )
        )
        indent += 1

        if self.dynamic:
            # Injects code to try casting a segment to all POTENTIAL types that
            # the defined routes could catch in this location
            self._inject_param_check(src, indent, idx)
            indent += 1

        else:
            if (
                not self.equality_check
                and self.groups
                and not self.first
                and first_sibling
            ):
                self.equality_check = first_sibling.equality_check

            # Maybe try and sneak an equality check in?
            if_stmt = "if"
            len_check = (
                f" and num == {self.level}"
                if not self.children and not self.equality_check
                else ""
            )

            self.equality_check |= bool(len_check)

            src.append(
                Line(
                    f'{if_stmt} parts[{idx}] == "{self.part}"{len_check}:'
                    "  # CHECK 4",
                    indent,
                )
            )
            self.base_indent += 1

        # Get ready to return some handlers
        if self.groups:
            return_indent = indent + return_bump
            route_idx: t.Union[int, str] = 0
            location = delayed

            # Do any missing equality_check
            if not self.equality_check:
                # If if we have not done an equality check and there are
                # children nodes, then we know there is a CHECK 1
                # for the children that starts at the same level, and will
                # be an exclusive conditional to what is being evaluated here.
                # Therefore, we can use elif
                #     example:
                #         if num == 7:  # CHECK 1
                #             child_node_stuff
                #         elif num == 6:  # CHECK 5
                #             current_node_stuff
                conditional = "elif" if self.children else "if"
                operation = "=="
                location.append(
                    Line(
                        f"{conditional} num {operation} {level}:  # CHECK 5",
                        return_indent,
                    )
                )
                return_indent += 1

            for group in sorted(self.groups, key=self._group_sorting):
                group_bump = 0

                # If the route had some requirements, let's make sure we check
                # them in the source
                if group.requirements:
                    route_idx = "route_idx"
                    self._inject_requirements(
                        location, return_indent + group_bump, group
                    )

                # This is for any inline regex routes. It sould not include,
                # path or path-like routes.
                if group.regex:
                    self._inject_regex(
                        location, return_indent + group_bump, group
                    )
                    group_bump += 1

                # Since routes are grouped, we need to know which to select
                # Inside the compiled source, we keep track so we know which
                # handler to assign this to
                if route_idx == 0 and len(group.routes) > 1:
                    route_idx = "route_idx"
                    self._inject_method_check(
                        location, return_indent + group_bump, group
                    )

                # The return.kingdom
                self._inject_return(
                    location, return_indent + group_bump, route_idx, group
                )

        return src, delayed, final

    def add_child(self, child: "Node") -> None:
        self._children[child.part] = child

    def _inject_param_check(self, location, indent, idx):
        """
        Try and cast relevant path segments.
        """
        lines = [
            Line("try:", indent),
            Line(
                f"basket['__matches__'][{idx}] = "
                f"{self.param.cast.__name__}(parts[{idx}])",
                indent + 1,
            ),
            Line("except ValueError:", indent),
            Line("pass", indent + 1),
            Line("else:", indent),
        ]
        if self.unquote:
            lines.append(
                Line(
                    f"basket['__matches__'][{idx}] = "
                    f"unquote(basket['__matches__'][{idx}])",
                    indent + 1,
                )
            )
        self.base_indent += 1

        location.extend(lines)

    @staticmethod
    def _inject_method_check(location, indent, group):
        """
        Sometimes we need to check the routing methods inside the generated src
        """
        for i, route in enumerate(group.routes):
            if_stmt = "if" if i == 0 else "elif"
            location.extend(
                [
                    Line(
                        f"{if_stmt} method in {route.methods}:",
                        indent,
                    ),
                    Line(f"route_idx = {i}", indent + 1),
                ]
            )
        location.extend(
            [
                Line("else:", indent),
                Line("raise NoMethod", indent + 1),
            ]
        )

    def _inject_return(self, location, indent, route_idx, group):
        """
        The return statement for the node if needed
        """
        routes = "regex_routes" if group.regex else "dynamic_routes"
        route_return = "" if group.router.stacking else f"[{route_idx}]"
        location.extend(
            [
                Line(f"# Return {self.ident}", indent),
                Line(
                    (
                        f"return router.{routes}[{group.segments}]"
                        f"{route_return}, basket"
                    ),
                    indent,
                ),
            ]
        )

    def _inject_requirements(self, location, indent, group):
        """
        Check any extra checks needed for a route. In path routing, for exampe,
        this is used for matching vhosts.
        """
        for k, route in enumerate(group):
            conditional = "if" if k == 0 else "elif"
            location.extend(
                [
                    Line(
                        (
                            f"{conditional} extra == {route.requirements} "
                            f"and method in {route.methods}:"
                        ),
                        indent,
                    ),
                    Line((f"route_idx = {k}"), indent + 1),
                ]
            )

        location.extend(
            [
                Line(("else:"), indent),
                Line(("raise NotFound"), indent + 1),
            ]
        )

    def _inject_regex(self, location, indent, group):
        """
        For any path matching that happens in the course of the tree (anything
        that has a path matching--<path:path>--or similar matching with regex
        delimiter)
        """
        location.extend(
            [
                Line(
                    (
                        "match = router.matchers"
                        f"[{group.pattern_idx}].match(path)"
                    ),
                    indent,
                ),
                Line("if match:", indent),
                Line(
                    "basket['__params__'] = match.groupdict()",
                    indent + 1,
                ),
            ]
        )

    def _sorting(self, item) -> t.Tuple[bool, bool, int, int, int, bool, str]:
        """
        Primarily use to sort nodes to determine the order of the nested tree
        """
        key, child = item
        type_ = 0
        if child.dynamic:
            type_ = child.param.priority

        return (
            bool(child.groups),
            child.dynamic,
            type_ * -1,
            child.depth * -1,
            len(child._children),
            not bool(
                child.groups and any(group.regex for group in child.groups)
            ),
            key,
        )

    def _group_sorting(self, item) -> t.Tuple[int, ...]:
        """
        When multiple RouteGroups terminate on the same node, we want to
        evaluate them based upon the priority of the param matching types
        """

        def get_type(segment):
            type_ = 0
            if segment.startswith("<"):
                key = segment[1:-1]
                if ":" in key:
                    key, param_type = key.split(":", 1)
                    try:
                        type_ = list(self.router.regex_types.keys()).index(
                            param_type
                        )
                    except ValueError:
                        type_ = len(list(self.router.regex_types.keys()))
            return type_ * -1

        segments = tuple(map(get_type, item.parts))
        return segments

    @property
    def depth(self):
        if not self._children:
            return self.level
        return max(child.depth for child in self._children.values())


class Tree:
    def __init__(self, router) -> None:
        self.root = Node(root=True, router=router)
        self.root.level = 0
        self.router = router

    def generate(self, groups: t.Iterable[RouteGroup]) -> None:
        """
        Arrange RouteGroups into hierarchical nodes and arrange them into
        a tree
        """
        for group in groups:
            current = self.root
            for level, part in enumerate(group.parts):
                param = None
                dynamic = part.startswith("<")
                if dynamic:
                    if not REGEX_PARAM_NAME.match(part):
                        raise ValueError(f"Invalid declaration: {part}")
                    part = f"__dynamic__:{group.params[level].label}"
                    param = group.params[level]
                if part not in current._children:
                    child = Node(
                        part=part,
                        parent=current,
                        router=self.router,
                        param=param,
                    )
                    child.dynamic = dynamic
                    current.add_child(child)
                current = current._children[part]
                current.level = level + 1

            current.groups.append(group)
            current.unquote = current.unquote or group.unquote

    def display(self) -> None:
        """
        Debug tool to output visual of the tree
        """
        self.root.display()

    def render(self) -> t.List[Line]:
        o, f = self.root.render()
        return o + f

    def finalize(self):
        self.root.finalize_children()
