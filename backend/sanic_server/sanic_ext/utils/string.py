import re

CAMEL_TO_SNAKE_PATTERNS = (
    re.compile(r"(.)([A-Z][a-z]+)"),
    re.compile(r"([a-z0-9])([A-Z])"),
)


def camel_to_snake(name: str) -> str:
    for pattern in CAMEL_TO_SNAKE_PATTERNS:
        name = pattern.sub(r"\1_\2", name)
    return name.lower()
