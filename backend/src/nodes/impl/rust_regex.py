from __future__ import annotations

from typing import Protocol

from chainner_ext import MatchGroup, RegexMatch, RustRegex


class Range(Protocol):
    @property
    def start(self) -> int: ...
    @property
    def end(self) -> int: ...


def get_range_text(text: str, range: Range) -> str:
    return text[range.start : range.end]


def match_to_replacements_dict(
    regex: RustRegex, match: RegexMatch, text: str
) -> dict[str, str]:
    def get_group_text(group: MatchGroup | None) -> str:
        if group is None:
            return ""
        return get_range_text(text, group)

    replacements: dict[str, str] = {}
    for i in range(regex.groups + 1):
        replacements[str(i)] = get_group_text(match.get(i))
    for name, i in regex.groupindex.items():
        replacements[name] = get_group_text(match.get(i))

    return replacements
