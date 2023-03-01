from __future__ import annotations

import hashlib
import struct
from random import Random
from typing import Union

from ...node_base import NodeBase, group
from ...node_factory import NodeFactory
from ...properties.inputs import BaseInput, NumberInput
from ...properties.outputs import NumberOutput
from ...utils.utils import ALPHABET
from . import category as UtilityCategory

SEED_MAX = 999_999
Source = Union[int, float, str]


def SourceInput(label: str):
    return BaseInput(
        kind="generic",
        label=label,
        input_type="number | string | Directory",
    ).make_optional()


def _to_bytes(s: Source) -> bytes:
    if isinstance(s, str):
        return s.encode(errors="backslashreplace")

    i = int(s)
    if isinstance(s, int) or s == i:
        return i.to_bytes(i.bit_length() // 8 + 1, byteorder="big", signed=True)

    return struct.pack("d", s)


@NodeFactory.register("chainner:utility:derive_seed")
class RandomNumberNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Creates a new seed from multiple sources of randomness."
        self.inputs = [
            group("seed")(
                NumberInput(
                    "Seed",
                    minimum=0,
                    maximum=None,
                ),
            ),
            SourceInput(f"Source A"),
            group("optional-list")(
                *[SourceInput(f"Source {letter}") for letter in ALPHABET[1:10]],
            ),
        ]
        self.outputs = [
            NumberOutput("Seed", output_type=f"int(0..{SEED_MAX})"),
        ]

        self.category = UtilityCategory
        self.name = "Derive Seed"
        self.icon = "MdCalculate"
        self.sub = "Random"

    def run(self, seed: int, *sources: Source | None) -> int:
        h = hashlib.sha256()

        h.update(_to_bytes(seed))
        for s in sources:
            if s is not None:
                h.update(_to_bytes(s))

        return Random(h.digest()).randint(0, SEED_MAX)
