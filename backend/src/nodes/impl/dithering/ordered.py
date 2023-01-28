from enum import Enum
from typing import Tuple

import numpy as np

from .common import dtype_to_float, float_to_dtype, apply_to_all_channels
from .quantize import uniform_quantize_image


class ThresholdMap(Enum):
    BAYER_2 = "B2"
    BAYER_4 = "B4"
    BAYER_8 = "B8"
    BAYER_16 = "B16"


THRESHOLD_MAP_LABELS = {
    ThresholdMap.BAYER_2: "Bayer 2x2",
    ThresholdMap.BAYER_4: "Bayer 4x4",
    ThresholdMap.BAYER_8: "Bayer 8x8",
    ThresholdMap.BAYER_16: "Bayer 16x16",
}
THRESHOLD_MAPS = {
    # https://en.wikipedia.org/wiki/Ordered_dithering
    ThresholdMap.BAYER_2: np.array(
        list(
            map(
                int,
                """
        0 2
        3 1
        """.strip().split(),
            )
        )
    ).reshape((2, 2)),
    ThresholdMap.BAYER_4: np.array(
        list(
            map(
                int,
                """
         0  8  2 10
        12  4 14  6
         3 11  1  9
        15  7 13  5
        """.strip().split(),
            )
        )
    ).reshape((4, 4)),
    ThresholdMap.BAYER_8: np.array(
        list(
            map(
                int,
                """
        0  32  8  40  2  34  10  42
        48  16  56  24  50  18  58  26
        12  44  4  36  14  46  6  38
        60  28  52  20  62  30  54  22
        3  35  11  43  1  33  9  41
        51  19  59  27  49  17  57  25
        15  47  7  39  13  45  5  37
        63  31  55  23  61  29  53  21
        """.strip().split(),
            )
        )
    ).reshape((8, 8)),
    ThresholdMap.BAYER_16: np.array(
        list(
            map(
                int,
                """
         0  191  48  239  12  203  60  251  3  194  51  242  15  206  63  254 
         127 64 175 112 139 76 187 124 130 67 178 115 142 79 190 127  
         32 223 16 207 44 235 28 219 35 226 19 210 47 238 31 222
         159 96 143 80 171 108 155 92 162 99 146 83 174 111 158 95 
         8 199 56 247 4 195 52 243 11 202 59 250 7 198 55 246 
         135 72 183 120 131 68 179 116 138 75 186 123 134 71 182 119  
         40 231 24 215 36 227 20 211 43 234 27 218 39 230 23 214 
         167 104 151 88 163 100 147 84 170 107 154 91 166 103 150 87  
         2 193 50 241 14 205 62 253 1 192 49 240 13 204 61 252 
         129 66 177 114 141 78 189 126 128 65 176 113 140 77 188 125  
         34 225 18 209 46 237 30 221 33 224 17 208 45 236 29 220 
         161 98 145 82 173 110 157 94 160 97 144 81 172 109 156 93 
         10 201 58 249 6 197 54 245 9 200 57 248 5 196 53 244 
         137 74 185 122 133 70 181 118 136 73 184 121 132 69 180 117  
         42 233 26 217 38 229 22 213 41 232 25 216 37 228 21 212 
         169 106 153 90 165 102 149 86 168 105 152 89 164 101 148 85  
        """.strip().split(),
            )
        )
    ).reshape((16, 16)),
}


def get_threshold_map(
    image_shape: Tuple[int, int], threshold_map: ThresholdMap
) -> np.ndarray:
    """
    Normalize the threshold map and tile it to match the given image shape.
    """
    tm = THRESHOLD_MAPS[threshold_map].astype("float32")
    tm = tm / tm.size - 0.5
    repeats = (np.array(image_shape) // tm.shape[0]) + 1
    tm = np.tile(tm, repeats)
    return tm[: image_shape[0], : image_shape[1]]


def one_channel_ordered_dither(
    image: np.ndarray, threshold_map: ThresholdMap, num_colors: int
) -> np.ndarray:
    """
    Apply an ordered dithering algorithm to the input greyscale image.  The output will be dithered and
    quantized to the given number of evenly-spaced values.

    The output will be the same shape and dtype as the input.
    """

    tm = get_threshold_map(image.shape, threshold_map=threshold_map)
    return float_to_dtype(
        np.floor((dtype_to_float(image) + tm) * (num_colors - 1) + 0.5) / (num_colors - 1),
        image.dtype)


def ordered_dither(
    image: np.ndarray, threshold_map: ThresholdMap, num_colors: int
) -> np.ndarray:
    return apply_to_all_channels(
        one_channel_ordered_dither,
        image,
        threshold_map=threshold_map,
        num_colors=num_colors,
    )
