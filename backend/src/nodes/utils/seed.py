from dataclasses import dataclass
from random import Random

_U32_MAX = 4294967296


@dataclass(frozen=True)
class Seed:
    value: int
    """
    The value of the seed. This value may be signed and generally have any range.
    """

    @staticmethod
    def from_bytes(b: bytes):
        return Seed(Random(b).randint(0, _U32_MAX - 1))

    def to_range(self, a: int, b: int) -> int:
        """
        Returns the value of the seed within the given range [a,b] both ends inclusive.

        If the current seed is not within the given range, a value within the range will be derived from the current seed.
        """
        if a <= self.value <= b:
            return self.value
        return Random(self.value).randint(a, b)

    def to_u32(self) -> int:
        """
        Returns the value of the seed as a 32bit unsigned integer.
        """
        return self.to_range(0, _U32_MAX - 1)

    def cache_key_func(self):
        return self.value
