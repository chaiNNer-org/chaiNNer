import numpy as np
from enum import Enum
from sanic.log import logger
from typing import Tuple, Dict

from .image_utils import MAX_VALUES_BY_DTYPE
from ..utils.utils import get_h_w_c


class ThresholdMap(Enum):
    BAYER_2 = "B2"
    BAYER_4 = "B4"
    BAYER_8 = "B8"
    BAYER_16 = "B16"
    ANGLED_HALFTONE_4 = "AH4"
    ANGLED_HALFTONE_6 = "AH6"
    ANGLED_HALFTONE_8 = "AH8"
    ORTHOGONAL_HALFTONE_4 = "OH4"
    ORTHOGONAL_HALFTONE_6 = "OH6"
    ORTHOGONAL_HALFTONE_8 = "OH8"
    ORTHOGONAL_HALFTONE_16 = "OH16"
    CIRCULAR_BLACK_5 = "CB5"
    CIRCULAR_BLACK_6 = "CB6"
    CIRCULAR_BLACK_7 = "CB7"
    CIRCULAR_WHITE_5 = "CW5"
    CIRCULAR_WHITE_6 = "CW6"
    CIRCULAR_WHITE_7 = "CW7"


THRESHOLD_MAP_LABELS = {
    ThresholdMap.BAYER_2: "Bayer 2x2",
    ThresholdMap.BAYER_4: "Bayer 4x4",
    ThresholdMap.BAYER_8: "Bayer 8x8",
    ThresholdMap.BAYER_16: "Bayer 16x16",
    ThresholdMap.ANGLED_HALFTONE_4: "Halftone 4x4 (45 degrees)",
    ThresholdMap.ANGLED_HALFTONE_6: "Halftone 6x6 (45 degrees)",
    ThresholdMap.ANGLED_HALFTONE_8: "Halftone 8x8 (45 degrees)",
    ThresholdMap.ORTHOGONAL_HALFTONE_4: "Halftone 4x4 (orthogonal)",
    ThresholdMap.ORTHOGONAL_HALFTONE_6: "Halftone 6x6 (orthogonal)",
    ThresholdMap.ORTHOGONAL_HALFTONE_8: "Halftone 8x8 (orthogonal)",
    ThresholdMap.ORTHOGONAL_HALFTONE_16: "Halftone 16x16 (orthogonal)",
    ThresholdMap.CIRCULAR_BLACK_5: "Black Circles 5x5",
    ThresholdMap.CIRCULAR_WHITE_5: "White Circles 5x5",
    ThresholdMap.CIRCULAR_BLACK_6: "Black Circles 6x6",
    ThresholdMap.CIRCULAR_WHITE_6: "White Circles 6x6",
    ThresholdMap.CIRCULAR_BLACK_7: "Black Circles 7x7",
    ThresholdMap.CIRCULAR_WHITE_7: "White Circles 7x7",
}

THRESHOLD_MAPS = {
    # https://en.wikipedia.org/wiki/Ordered_dithering
    ThresholdMap.BAYER_2: np.array(list(map(int, """
        0 2
        3 1
        """.strip().split()))).reshape((2, 2)),
    ThresholdMap.BAYER_4: np.array(list(map(int, """
         0  8  2 10
        12  4 14  6
         3 11  1  9
        15  7 13  5
        """.strip().split()))).reshape((4, 4)),
    ThresholdMap.BAYER_8: np.array(list(map(int, """
        0  32  8  40  2  34  10  42
        48  16  56  24  50  18  58  26
        12  44  4  36  14  46  6  38
        60  28  52  20  62  30  54  22
        3  35  11  43  1  33  9  41
        51  19  59  27  49  17  57  25
        15  47  7  39  13  45  5  37
        63  31  55  23  61  29  53  21
        """.strip().split()))).reshape((8, 8)),
    ThresholdMap.BAYER_16: np.array(list(map(int, """
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
        """.strip().split()))).reshape((16, 16)),

    # halftone thresholds
    # https://github.com/ImageMagick/ImageMagick/blob/main/config/thresholds.xml

    # Angled 45 Degrees
    ThresholdMap.ANGLED_HALFTONE_4: np.array(list(map(int, """
        4  2  7  5
        3  1  8  6
        7  5  4  2
        8  6  3  1
        """.strip().split()))).reshape((4, 4)),
    ThresholdMap.ANGLED_HALFTONE_6: np.array(list(map(int, """
        14  13  10   8   2   3
        16  18  12   7   1   4
        15  17  11   9   6   5
        8   2   3  14  13  10
        7   1   4  16  18  12
        9   6   5  15  17  11
        """.strip().split()))).reshape((6, 6)),
    ThresholdMap.ANGLED_HALFTONE_8: np.array(list(map(int, """
        13   7   8  14  17  21  22  18
        6   1   3   9  28  31  29  23
        5   2   4  10  27  32  30  24
        16  12  11  15  20  26  25  19
        17  21  22  18  13   7   8  14
        28  31  29  23   6   1   3   9
        27  32  30  24   5   2   4  10
        20  26  25  19  16  12  11  15
        """.strip().split()))).reshape((8, 8)),

    # Orthogonally aligned
    ThresholdMap.ORTHOGONAL_HALFTONE_4: np.array(list(map(int, """
        7  13  11   4
       12  16  14   8
       10  15   6   2
        5   9   3   1
        """.strip().split()))).reshape((4, 4)),
    ThresholdMap.ORTHOGONAL_HALFTONE_6: np.array(list(map(int, """
        7  17  27  14   9   4
       21  29  33  31  18  11
       24  32  36  34  25  22
       19  30  35  28  20  10
        8  15  26  16   6   2
        5  13  23  12   3   1
        """.strip().split()))).reshape((6, 6)),
    ThresholdMap.ORTHOGONAL_HALFTONE_8: np.array(list(map(int, """
        7  21  33  43  36  19   9   4
       16  27  51  55  49  29  14  11
       31  47  57  61  59  45  35  23
       41  53  60  64  62  52  40  38
       37  44  58  63  56  46  30  22
       15  28  48  54  50  26  17  10
        8  18  34  42  32  20   6   2
        5  13  25  39  24  12   3   1
        """.strip().split()))).reshape((8, 8)),
    ThresholdMap.ORTHOGONAL_HALFTONE_16: np.array(list(map(int, """
        4  12  24  44  72 100 136 152 150 134  98  70  42  23  11   3
        7  16  32  52  76 104 144 160 158 142 102  74  50  31  15   6
       19  27  40  60  92 132 168 180 178 166 130  90  58  39  26  18
       36  48  56  80 124 176 188 204 203 187 175 122  79  55  47  35
       64  68  84 116 164 200 212 224 223 211 199 162 114  83  67  63
       88  96 112 156 192 216 232 240 239 231 214 190 154 111  95  87
      108 120 148 184 208 228 244 252 251 243 226 206 182 147 119 107
      128 140 172 196 219 235 247 256 255 246 234 218 194 171 139 127
      126 138 170 195 220 236 248 253 254 245 233 217 193 169 137 125
      106 118 146 183 207 227 242 249 250 241 225 205 181 145 117 105
       86  94 110 155 191 215 229 238 237 230 213 189 153 109  93  85
       62  66  82 115 163 198 210 221 222 209 197 161 113  81  65  61
       34  46  54  78 123 174 186 202 201 185 173 121  77  53  45  33
       20  28  37  59  91 131 167 179 177 165 129  89  57  38  25  17
        8  13  29  51  75 103 143 159 157 141 101  73  49  30  14   5
        1   9  21  43  71  99 135 151 149 133  97  69  41  22  10   2
        """.strip().split()))).reshape((16, 16)),

    # Circular Patterns
    ThresholdMap.CIRCULAR_BLACK_5: np.array(list(map(int, """
         1 21 16 15  4
         5 17 20 19 14
         6 21 25 24 12
         7 18 22 23 11
         2  8  9 10  3
        """.strip().split()))).reshape((5, 5)),

    ThresholdMap.CIRCULAR_WHITE_5: np.array(list(map(int, """
        25 21 10 11 22
        20  9  6  7 12
        19  5  1  2 13
        18  8  4  3 14
        24 17 16 15 23
        """.strip().split()))).reshape((5, 5)),

    ThresholdMap.CIRCULAR_BLACK_6: np.array(list(map(int, """
         1  5 14 13 12  4
         6 22 28 27 21 11
        15 29 35 34 26 20
        16 30 36 33 25 19
         7 23 31 32 24 10
         2  8 17 18  9  3
        """.strip().split()))).reshape((6, 6)),

    ThresholdMap.CIRCULAR_WHITE_6: np.array(list(map(int, """
        36 32 23 24 25 33
        31 15  9 10 16 26
        22  8  2  3 11 17
        21  7  1  4 12 18
        30 14  6  5 13 27
        35 29 20 19 28 34
        """.strip().split()))).reshape((6, 6)),

    ThresholdMap.CIRCULAR_BLACK_7: np.array(list(map(int, """
        3  9 18 28 17  8  2
       10 24 33 39 32 23  7
       19 34 44 48 43 31 16
       25 40 45 49 47 38 27
       20 35 41 46 42 29 15
       11 21 36 37 28 22  6
        4 12 13 26 14  5  1
        """.strip().split()))).reshape((7, 7)),

    ThresholdMap.CIRCULAR_WHITE_7: np.array(list(map(int, """
       47 41 32 22 33 42 48
       40 26 17 11 18 27 43
       31 16  6  2  7 19 34
       25 10  5  1  3 12 23
       30 15  9  4  8 20 35
       39 29 14 13 21 28 44
       46 38 37 24 36 45 49
       """.strip().split()))).reshape((7, 7)),

}


class ErrorDiffusionMap(Enum):
    FLOYD_STEINBERG = "FS"
    JARVIS_ET_AL = "JJN"
    STUCKI = "ST"
    ATKINSON = "A"
    BURKES = "B"
    SIERRA = "S"
    TWO_ROW_SIERRA = "S2"
    SIERRA_LITE = "SL"


ERROR_PROPAGATION_MAP_LABELS = {
    ErrorDiffusionMap.FLOYD_STEINBERG: "Floyd-Steinberg",
    ErrorDiffusionMap.JARVIS_ET_AL: "Jarvis, Judice, and Ninke",
    ErrorDiffusionMap.STUCKI: "Stucki",
    ErrorDiffusionMap.ATKINSON: "Atkinson",
    ErrorDiffusionMap.BURKES: "Burkes",
    ErrorDiffusionMap.SIERRA: "Sierra",
    ErrorDiffusionMap.TWO_ROW_SIERRA: "Two Row Sierra",
    ErrorDiffusionMap.SIERRA_LITE: "Sierra Lite",
}

ERROR_DIFFUSION_MAP_TYPE = Dict[Tuple[int, int], float]
ERROR_DIFFUSION_MAPS: Dict[ErrorDiffusionMap, ERROR_DIFFUSION_MAP_TYPE] = {
    # https://tannerhelland.com/2012/12/28/dithering-eleven-algorithms-source-code.html
    ErrorDiffusionMap.FLOYD_STEINBERG: {
        (1, 0): 7 / 16,
        (-1, 1): 3 / 16,
        (0, 1): 5 / 16,
        (1, 1): 1 / 16,
    },
    ErrorDiffusionMap.JARVIS_ET_AL: {
        (1, 0): 7 / 48,
        (2, 0): 5 / 48,
        (-2, 1): 3 / 48,
        (-1, 1): 5 / 48,
        (0, 1): 7 / 48,
        (1, 1): 5 / 48,
        (2, 1): 3 / 48,
        (-2, 2): 1 / 48,
        (-1, 2): 3 / 48,
        (0, 2): 5 / 48,
        (1, 2): 3 / 48,
        (2, 2): 1 / 48,
    },
    ErrorDiffusionMap.STUCKI: {
        (1, 0): 8 / 42,
        (2, 0): 4 / 42,
        (-2, 1): 2 / 42,
        (-1, 1): 4 / 42,
        (0, 1): 8 / 42,
        (1, 1): 4 / 42,
        (2, 1): 2 / 42,
        (-2, 2): 1 / 42,
        (-1, 2): 2 / 42,
        (0, 2): 4 / 42,
        (1, 2): 2 / 42,
        (2, 2): 1 / 42,
    },
    ErrorDiffusionMap.ATKINSON: {
        (1, 0): 1 / 8,
        (2, 0): 1 / 8,
        (-1, 1): 1 / 8,
        (0, 1): 1 / 8,
        (1, 1): 1 / 8,
        (0, 2): 1 / 8,
    },
    ErrorDiffusionMap.BURKES: {
        (1, 0): 8 / 32,
        (2, 0): 4 / 32,
        (-2, 1): 2 / 32,
        (-1, 1): 4 / 32,
        (0, 1): 8 / 32,
        (1, 1): 4 / 32,
        (2, 1): 2 / 32,
    },
    ErrorDiffusionMap.SIERRA: {
        (1, 0): 5 / 32,
        (2, 0): 3 / 32,
        (-2, 1): 2 / 32,
        (-1, 1): 4 / 32,
        (0, 1): 5 / 32,
        (1, 1): 4 / 32,
        (2, 1): 2 / 32,
        (-1, 2): 2 / 32,
        (0, 2): 3 / 32,
        (1, 2): 2 / 32,
    },
    ErrorDiffusionMap.TWO_ROW_SIERRA: {
        (1, 0): 4 / 16,
        (2, 0): 3 / 16,
        (-2, 1): 1 / 16,
        (-1, 1): 2 / 16,
        (0, 1): 3 / 16,
        (1, 1): 2 / 16,
        (2, 1): 1 / 16,
    },
    ErrorDiffusionMap.SIERRA_LITE: {
        (1, 0): 2 / 4,
        (-1, 1): 1 / 4,
        (0, 1): 1 / 4,
    },
}


def get_threshold_map(image_shape: Tuple[int, int], threshold_map: ThresholdMap) -> np.ndarray:
    """
    Normalize the threshold map and tile it to match the given image shape.
    """
    tm = THRESHOLD_MAPS[threshold_map].astype("float32")
    tm = tm / tm.size - 0.5
    repeats = (np.array(image_shape) // tm.shape[0]) + 1
    tm = np.tile(tm, repeats)
    return tm[: image_shape[0], : image_shape[1]]

def get_error_diffusion_map(error_diffusion_map: ErrorDiffusionMap) -> ERROR_DIFFUSION_MAP_TYPE:
    return ERROR_DIFFUSION_MAPS[error_diffusion_map]


def dtype_to_float(image: np.ndarray) -> np.ndarray:
    max_value = MAX_VALUES_BY_DTYPE.get(image.dtype, 1.0)
    return image.astype(np.dtype("float32")) / max_value


def float_to_dtype(image: np.ndarray, dtype: np.dtype) -> np.ndarray:
    max_value = MAX_VALUES_BY_DTYPE.get(dtype, 1.0)
    return (image * max_value).astype(dtype)


def uniform_quantize_image(image: np.ndarray, num_colors: int) -> np.ndarray:
    return np.floor(image * (num_colors - 1) + 0.5) / (num_colors - 1)


def find_closest_uniform_color(value: float, num_colors: int) -> float:
    return np.floor(value * (num_colors - 1) + 0.5) / (num_colors - 1)


def one_channel_uniform_quantize(image: np.ndarray, num_colors: int) -> np.ndarray:
    out_image = uniform_quantize_image(
        dtype_to_float(image), num_colors=num_colors
    )
    return float_to_dtype(out_image, image.dtype)


def one_channel_ordered_dither(image: np.ndarray, threshold_map: ThresholdMap, num_colors: int) -> np.ndarray:
    """
    Apply an ordered dithering algorithm to the input greyscale image.  The output will be dithered and
    quantized to the given number of evenly-spaced values.

    The output will be the same shape and dtype as the input.
    """

    tm = get_threshold_map(image.shape, threshold_map=threshold_map)
    out_image = uniform_quantize_image(
        dtype_to_float(image) + tm, num_colors=num_colors
    )
    return float_to_dtype(out_image, image.dtype)


def one_channel_error_diffusion(image: np.ndarray, num_colors: int,
                                error_diffusion_map: ERROR_DIFFUSION_MAP_TYPE) -> np.ndarray:
    output_image = dtype_to_float(image)
    edm = get_error_diffusion_map(error_diffusion_map)
    for j in range(output_image.shape[1]):
        for i in range(output_image.shape[0]):
            pixel = output_image[i, j]
            output_image[i, j] = find_closest_uniform_color(pixel, num_colors)
            error = pixel - output_image[i, j]
            for (di, dj), coefficient in edm.items():
                if i + di >= output_image.shape[0] or j + dj >= output_image.shape[1]: continue
                output_image[i + di, j + dj] += error * coefficient
    return float_to_dtype(output_image, image.dtype)


def apply_to_all_channels(one_channel_filter, image: np.ndarray, *args, **kwargs) -> np.ndarray:
    if image.ndim == 2:
        return one_channel_filter(image, *args, **kwargs)
    output_image = np.stack(
        [
            one_channel_filter(image[:, :, channel], *args, **kwargs)
            for channel in range(image.shape[2])
        ],
        axis=2,
    )
    return output_image


def uniform_quantize(image: np.ndarray, num_colors: int) -> np.ndarray:
    return apply_to_all_channels(one_channel_uniform_quantize, image, num_colors=num_colors)


def ordered_dither(image: np.ndarray, threshold_map: ThresholdMap, num_colors: int) -> np.ndarray:
    return apply_to_all_channels(one_channel_ordered_dither,
                                 image, threshold_map=threshold_map, num_colors=num_colors)


def error_diffusion_dither(image: np.ndarray, error_diffusion_map: ErrorDiffusionMap, num_colors: int) -> np.ndarray:
    return apply_to_all_channels(one_channel_error_diffusion,
                                 image, num_colors=num_colors, error_diffusion_map=error_diffusion_map)


# TODO handle palettes
#  extra from image
#  optimal palette selection
#  ensure palette different colorspace works
#  support different color distance functions