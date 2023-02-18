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

        lastIndex = 0
        lastStr = ""
        for m in re.compile(r"(\{\{)|\{([^{}]*)\}").finditer(pattern):
            lastStr += pattern[lastIndex : m.start()]
            lastIndex = m.end()

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

                self.tokens.append(lastStr)
                lastStr = ""
                self.tokens.append(ReplacementInterpolation(interpolation))
                self.names.add(interpolation)
            else:
                lastStr += "{"
        lastStr += pattern[lastIndex:]
        self.tokens.append(lastStr)

    def replace(self, replacements: dict[str, str]) -> str:
        result = ""

        for token in self.tokens:
            if isinstance(token, str):
                result += token
            else:
                if token.name in replacements:
                    result += replacements[token.name]
                else:
                    raise ValueError(
                        "Unknown replacement."
                        f" There is no replacement with the name or id {token.name}."
                        f" Available replacements: {', '.join(replacements.keys()) }."
                    )

        return result
