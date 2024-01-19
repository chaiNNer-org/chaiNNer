from __future__ import annotations

import json
from typing import Iterable, Literal, TypedDict, Union, cast

import numpy as np

from nodes.utils.utils import get_h_w_c

FloatLike = Union[np.floating, float]


def _norm(n: FloatLike) -> float:
    return max(0, min(float(n), 1))


ColorJsonKind = Literal["grayscale", "rgb", "rgba"]


class ColorJson(TypedDict):
    kind: ColorJsonKind
    values: list[float]


class Color:
    def __init__(self, value: tuple[float, ...]) -> None:
        if len(value) == 0:
            raise ValueError("Colors must have at least one channel.")
        self.value: tuple[float, ...] = value

    @property
    def channels(self) -> int:
        return len(self.value)

    @staticmethod
    def gray(gray: FloatLike) -> Color:
        return Color((_norm(gray),))

    @staticmethod
    def bgr(value: Iterable[FloatLike]) -> Color:
        t = tuple(map(_norm, value))
        if len(t) != 3:
            raise ValueError("RGB colors must have 3 channels.")
        return Color(t)

    @staticmethod
    def bgra(value: Iterable[FloatLike]) -> Color:
        t = tuple(map(_norm, value))
        if len(t) != 4:
            raise ValueError("RGBA colors must have 4 channels.")
        return Color(t)

    @staticmethod
    def from_1x1_image(img: np.ndarray) -> Color:
        h, w, c = get_h_w_c(img)
        if not (h == w == 1):
            raise ValueError("The image must be 1x1.")

        if c == 1:
            return Color.gray(img.flat[0])
        elif c == 3:
            return Color.bgr(img.flat)
        elif c == 4:
            return Color.bgra(img.flat)
        else:
            raise AssertionError("Only grayscale, RGB, and RGBA colors are supported.")

    @staticmethod
    def from_json(color_json: ColorJson | str) -> Color:
        if isinstance(color_json, str):
            color_json = cast(ColorJson, json.loads(color_json))
        kind = color_json["kind"]
        values = color_json["values"]

        if kind == "grayscale":
            if len(values) != 1:
                raise ValueError("Grayscale colors must have 1 channel.")
            return Color.gray(values[0])
        elif kind == "rgb":
            if len(values) != 3:
                raise ValueError("RGB colors must have 3 channels.")
            return Color.bgr([values[2], values[1], values[0]])
        elif kind == "rgba":
            if len(values) != 4:
                raise ValueError("RGBA colors must have 4 channels.")
            return Color.bgra([values[2], values[1], values[0], values[3]])
        else:
            raise AssertionError(f"Unknown color kind {kind}")

    def to_1x1_image(self) -> np.ndarray:
        return self.to_image(1, 1)

    def to_image(self, width: int, height: int) -> np.ndarray:
        v = self.value
        if len(v) == 1:
            return np.full((height, width), v[0], dtype=np.float32)
        else:
            return np.full((height, width, len(v)), v, dtype=np.float32)

    def to_json(self) -> ColorJson:
        values = list(self.value)
        kind: ColorJsonKind
        if len(values) == 1:
            kind = "grayscale"
        elif len(values) == 3:
            kind = "rgb"
            values = [values[2], values[1], values[0]]
        elif len(values) == 4:
            kind = "rgba"
            values = [values[2], values[1], values[0], values[3]]
        else:
            raise AssertionError(f"Colors with {len(values)} are not supported.")

        return {"kind": kind, "values": values}
