from __future__ import annotations

import hashlib
import struct
from typing import Union

from nodes.group import group
from nodes.properties.inputs import BaseInput, SeedInput
from nodes.properties.outputs import SeedOutput
from nodes.utils.seed import Seed
from nodes.utils.utils import ALPHABET

from .. import random_group

Source = Union[int, float, str, Seed]


def SourceInput(label: str):
    return BaseInput(
        kind="generic",
        label=label,
        input_type="number | string | Directory | Seed",
    ).make_optional()


def _to_bytes(s: Source) -> bytes:
    if isinstance(s, str):
        return s.encode(errors="backslashreplace")
    if isinstance(s, Seed):
        s = s.value

    i = int(s)
    if isinstance(s, int) or s == i:
        return i.to_bytes(i.bit_length() // 8 + 1, byteorder="big", signed=True)

    return struct.pack("d", s)


@random_group.register(
    schema_id="chainner:utility:derive_seed",
    name="Derive Seed",
    description="Creates a new seed from multiple sources of randomness.",
    icon="MdCalculate",
    inputs=[
        group("seed")(SeedInput(has_handle=False)),
        SourceInput(f"Source A"),
        group("optional-list")(
            *[SourceInput(f"Source {letter}") for letter in ALPHABET[1:10]],
        ),
    ],
    outputs=[
        SeedOutput(),
    ],
)
def derive_seed_node(seed: Seed, *sources: Source | None) -> Seed:
    if all([s is None for s in sources]):
        # return seed as is if there are no sources of randomness
        # this is useful for extracting out seeds
        return seed

    h = hashlib.sha256()

    h.update(_to_bytes(seed))
    for s in sources:
        if s is not None:
            h.update(_to_bytes(s))

    return Seed.from_bytes(h.digest())
