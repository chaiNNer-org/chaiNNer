from enum import Enum


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


# https://en.wikipedia.org/wiki/Ordered_dithering


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
