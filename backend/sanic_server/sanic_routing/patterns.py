import re
import uuid
from datetime import date, datetime


def parse_date(d) -> date:
    return datetime.strptime(d, "%Y-%m-%d").date()


def alpha(param: str) -> str:
    if not param.isalpha():
        raise ValueError(f"Value {param} contains non-alphabetic chracters")
    return param


def slug(param: str) -> str:
    if not REGEX_TYPES["slug"][1].match(param):
        raise ValueError(f"Value {param} does not match the slug format")
    return param


REGEX_PARAM_NAME = re.compile(r"^<([a-zA-Z_][a-zA-Z0-9_]*)(?::(.*))?>$")

# Predefined path parameter types. The value is a tuple consisteing of a
# callable and a compiled regular expression.
# The callable should:
#   1. accept a string input
#   2. cast the string to desired type
#   3. raise ValueError if it cannot
# The regular expression is generally NOT used. Unless the path is forced
# to use regex patterns.
REGEX_TYPES = {
    "str": (str, re.compile(r"^[^/]+$")),
    "slug": (slug, re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")),
    "alpha": (alpha, re.compile(r"^[A-Za-z]+$")),
    "path": (str, re.compile(r"^[^/]?.*?$")),
    "float": (float, re.compile(r"^-?(?:\d+(?:\.\d*)?|\.\d+)$")),
    "int": (int, re.compile(r"^-?\d+$")),
    "ymd": (
        parse_date,
        re.compile(r"^([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))$"),
    ),
    "uuid": (
        uuid.UUID,
        re.compile(
            r"^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-"
            r"[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$"
        ),
    ),
}
