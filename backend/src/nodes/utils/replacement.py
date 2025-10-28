from __future__ import annotations

import re


class ReplacementInterpolation:
    def __init__(self, name: str):
        self.name = name


class ReplacementString:
    """
    A parser and interpolator for chainner's string replacement patterns.

    The syntax is as follows (ANTLR 4):

        Pattern: ( LiteralChar | EscapedChar | Interpolation )* ;
        LiteralChar: ~[{] ; // any character except "{"
        EscapedChar: '{{' ;
        Interpolation: '{' InterpolationContent '}' ;
        InterpolationContent: [A-Za-z0-9]+ ;
    """

    def __init__(self, pattern: str):
        self.tokens: list[str | ReplacementInterpolation] = []
        self.names: set[str] = set()

        content_pattern = re.compile(r"\A\w+\Z")

        last_index = 0
        last_str = ""
        for m in re.compile(r"(\{\{)|\{([^{}]*)\}").finditer(pattern):
            last_str += pattern[last_index : m.start()]
            last_index = m.end()

            interpolation = m.group(2)
            if interpolation is not None:
                if interpolation == "":
                    raise ValueError(
                        "Invalid replacement pattern. {} is not a valid replacement."
                        """ Either specify a name or id number, or escape a single "{" as "{{"."""
                        f" Full pattern: {pattern}"
                    )
                if content_pattern.fullmatch(interpolation) is None:
                    raise ValueError(
                        "Invalid replacement pattern."
                        f" {{{interpolation}}} is not a valid replacement."
                        " Names and ids only allow letters and digits."
                        f" Full pattern: {pattern}"
                    )

                self.tokens.append(last_str)
                last_str = ""
                self.tokens.append(ReplacementInterpolation(interpolation))
                self.names.add(interpolation)
            else:
                last_str += "{"
        last_str += pattern[last_index:]
        self.tokens.append(last_str)

    def replace(self, replacements: dict[str, str]) -> str:
        result = ""

        for token in self.tokens:
            if isinstance(token, str):
                result += token
            elif token.name in replacements:
                result += replacements[token.name]
            else:
                raise ValueError(
                    "Unknown replacement."
                    f" There is no replacement with the name or id {token.name}."
                    f" Available replacements: {', '.join(replacements.keys())}."
                )

        return result
