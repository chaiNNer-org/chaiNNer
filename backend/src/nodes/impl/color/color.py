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
        assert len(value) >= 1
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
        assert len(t) == 3
        return Color(t)

    @staticmethod
    def bgra(value: Iterable[FloatLike]) -> Color:
        t = tuple(map(_norm, value))
        assert len(t) == 4
        return Color(t)

    @staticmethod
    def from_1x1_image(img: np.ndarray) -> Color:
        h, w, c = get_h_w_c(img)
        assert h == w == 1

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
            assert len(values) == 1
            return Color.gray(values[0])
        elif kind == "rgb":
            assert len(values) == 3
            return Color.bgr([values[2], values[1], values[0]])
        elif kind == "rgba":
            assert len(values) == 4
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

    def to_bgr(self) -> Color:
        if self.channels == 1:
            return Color.bgr([self.value[0], self.value[0], self.value[0]])
        elif self.channels == 4:
            return Color.bgr([self.value[0], self.value[1], self.value[2]])
        else:
            return Color.bgr(self.value)

    def to_bgra(self) -> Color:
        if self.channels == 1:
            return Color.bgra([self.value[0], self.value[0], self.value[0], 1])
        elif self.channels == 3:
            return Color.bgra([self.value[0], self.value[1], self.value[2], 1])
        else:
            return Color.bgra(self.value)

    def to_gray(self) -> Color:
        if self.channels == 1:
            return Color.gray(self.value[0])
        else:
            # values from https://stackoverflow.com/questions/41971663/use-numpy-to-convert-rgb-pixel-array-into-grayscale
            return Color.gray(np.dot(self.value, [0.299, 0.587, 0.114]))
