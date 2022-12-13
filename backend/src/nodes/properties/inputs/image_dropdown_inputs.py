import cv2

# pylint: disable=relative-beyond-top-level
from ...utils.image_utils import BorderType
from ...utils.pil_utils import InterpolationMethod, RotateExpandCrop
from ...utils.tile_util import TileMode
from ...utils.height import HeightSource
from ...utils.edge_filter import EdgeFilters
from ...utils.color.convert_data import color_spaces, color_spaces_or_detectors
from ..expression import named
from .generic_inputs import DropDownInput


def ColorSpaceInput(
    label: str = "Color Space",
    detector: bool = False,
) -> DropDownInput:
    l = color_spaces_or_detectors if detector else color_spaces
    return DropDownInput(
        input_type="ColorSpace",
        label=label,
        options=[
            {
                "option": c.name,
                "value": c.id,
                "type": named("ColorSpace", {"channels": c.channels}),
            }
            for c in l
        ],
    )


def InterpolationInput() -> DropDownInput:
    """Resize interpolation dropdown"""
    return DropDownInput(
        input_type="InterpolationMode",
        label="Interpolation Method",
        options=[
            {
                "option": "Auto",
                "value": InterpolationMethod.AUTO,
            },
            {
                "option": "Nearest Neighbor",
                "value": InterpolationMethod.NEAREST,
            },
            {
                "option": "Area (Box)",
                "value": InterpolationMethod.BOX,
            },
            {
                "option": "Linear",
                "value": InterpolationMethod.LINEAR,
            },
            {
                "option": "Cubic",
                "value": InterpolationMethod.CUBIC,
            },
            {
                "option": "Lanczos",
                "value": InterpolationMethod.LANCZOS,
            },
        ],
    )


def ResizeToSideInput() -> DropDownInput:
    """Resize to side dropdown"""
    return DropDownInput(
        input_type="SideSelection",
        label="Resize To",
        options=[
            {
                "option": "Width",
                "value": "width",
                "type": "SideSelection::Width",
            },
            {
                "option": "Height",
                "value": "height",
                "type": "SideSelection::Height",
            },
            {
                "option": "Shorter Side",
                "value": "shorter side",
                "type": "SideSelection::Shorter",
            },
            {
                "option": "Longer Side",
                "value": "longer side",
                "type": "SideSelection::Longer",
            },
        ],
    )


def ResizeCondition() -> DropDownInput:
    """Upscale / Downscale condition dropdown"""
    return DropDownInput(
        input_type="ResizeCondition",
        label="Resize Condition",
        options=[
            {
                "option": "Upscale And Downscale",
                "value": "both",
                "type": "ResizeCondition::Both",
            },
            {
                "option": "Upscale Only",
                "value": "upscale",
                "type": "ResizeCondition::Upscale",
            },
            {
                "option": "Downscale Only",
                "value": "downscale",
                "type": "ResizeCondition::Downscale",
            },
        ],
    )


def RotateInterpolationInput() -> DropDownInput:
    return DropDownInput(
        input_type="RotateInterpolationMode",
        label="Interpolation Method",
        options=[
            {
                "option": "Cubic",
                "value": InterpolationMethod.CUBIC,
            },
            {
                "option": "Linear",
                "value": InterpolationMethod.LINEAR,
            },
            {
                "option": "Nearest Neighbor",
                "value": InterpolationMethod.NEAREST,
            },
        ],
    )


def RotateExpansionInput() -> DropDownInput:
    return DropDownInput(
        input_type="RotateSizeChange",
        label="Image Dimensions",
        options=[
            {
                "option": "Expand to fit",
                "value": RotateExpandCrop.EXPAND,
                "type": "RotateSizeChange::Expand",
            },
            {
                "option": "Crop to original",
                "value": RotateExpandCrop.CROP,
                "type": "RotateSizeChange::Crop",
            },
        ],
    )


def BlurInput() -> DropDownInput:
    """Blur option dropdown"""
    return DropDownInput(
        input_type="BlurMode",
        label="Blur Mode",
        options=[
            {"option": "Box", "value": 0},
            {"option": "Blur", "value": 1},
            {"option": "Gaussian", "value": 2},
        ],
    )


def BorderInput() -> DropDownInput:
    """CopyMakeBorder option dropdown"""
    return DropDownInput(
        input_type="BorderType",
        label="Border Type",
        options=[
            {
                "option": "Reflect (Mirror)",
                "value": BorderType.REFLECT_MIRROR,
                "type": "BorderType::ReflectMirror",
            },
            {
                "option": "Wrap (Tile)",
                "value": BorderType.WRAP,
                "type": "BorderType::Wrap",
            },
            {
                "option": "Replicate Edges",
                "value": BorderType.REPLICATE,
                "type": "BorderType::Replicate",
            },
            {
                "option": "Black",
                "value": BorderType.BLACK,
                "type": "BorderType::Black",
            },
            {
                "option": "Transparent",
                "value": BorderType.TRANSPARENT,
                "type": "BorderType::Transparent",
            },
        ],
    )


def ThresholdInput() -> DropDownInput:
    """Threshold type option dropdown"""
    return DropDownInput(
        input_type="ThresholdType",
        label="Threshold Type",
        options=[
            {
                "option": "Binary",
                "value": cv2.THRESH_BINARY,
            },
            {
                "option": "Binary (Inverted)",
                "value": cv2.THRESH_BINARY_INV,
            },
            {
                "option": "Truncated",
                "value": cv2.THRESH_TRUNC,
            },
            {
                "option": "To Zero",
                "value": cv2.THRESH_TOZERO,
            },
            {
                "option": "To Zero (Inverted)",
                "value": cv2.THRESH_TOZERO_INV,
            },
        ],
    )


def AdaptiveThresholdInput() -> DropDownInput:
    """Adaptive Threshold type option dropdown"""
    return DropDownInput(
        input_type="AdaptiveThresholdType",
        label="Threshold Type",
        options=[
            {
                "option": "Binary",
                "value": cv2.THRESH_BINARY,
            },
            {
                "option": "Binary (Inverted)",
                "value": cv2.THRESH_BINARY_INV,
            },
        ],
    )


def AdaptiveMethodInput() -> DropDownInput:
    """Adaptive method border option dropdown"""
    return DropDownInput(
        input_type="AdaptiveMethod",
        label="Adaptive Method",
        options=[
            {
                "option": "Mean - C",
                "value": cv2.ADAPTIVE_THRESH_MEAN_C,
            },
            {
                "option": "Gaussian - C",
                "value": cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            },
        ],
    )


def TileModeInput():
    return DropDownInput(
        input_type="TileMode",
        label="Tile Mode",
        options=[
            {
                "option": "Tile",
                "value": TileMode.TILE,
            },
            {
                "option": "Mirror",
                "value": TileMode.MIRROR,
            },
        ],
    )


def CaptionPositionInput() -> DropDownInput:
    """Select Caption Position"""
    return DropDownInput(
        input_type="CaptionPosition",
        label="Caption Position",
        options=[
            {
                "option": "Bottom",
                "value": "bottom",
            },
            {
                "option": "Top",
                "value": "top",
            },
        ],
    )


def EdgeFilterInput() -> DropDownInput:
    return DropDownInput(
        input_type="EdgeFilter",
        label="Filter",
        options=[
            {
                "option": "Sobel (dUdV) (3x3)",
                "value": EdgeFilters.Sobel,
            },
            {
                "option": "Sobel-like (5x5)",
                "value": EdgeFilters.SobelLike5,
            },
            {
                "option": "Sobel-like (7x7)",
                "value": EdgeFilters.SobelLike7,
            },
            {
                "option": "Sobel-like (9x9)",
                "value": EdgeFilters.SobelLike9,
            },
            {
                "option": "Prewitt (3x3)",
                "value": EdgeFilters.Prewitt,
            },
            {
                "option": "Scharr (3x3)",
                "value": EdgeFilters.Scharr,
            },
            {
                "option": "4 Sample (1x3)",
                "value": EdgeFilters.FourSample,
            },
        ],
    )


def HeightMapSourceInput() -> DropDownInput:
    return DropDownInput(
        input_type="HeightMapSource",
        label="Height Source",
        options=[
            {
                "option": "Average RGB",
                "value": HeightSource.AVG_RGB,
            },
            {
                "option": "Max RGB",
                "value": HeightSource.MAX_RGB,
            },
            {
                "option": "Screen RGB",
                "value": HeightSource.SCREEN_RGB,
            },
            {
                "option": "Alpha",
                "value": HeightSource.A,
            },
            {
                "option": "Red",
                "value": HeightSource.R,
            },
            {
                "option": "Green",
                "value": HeightSource.G,
            },
            {
                "option": "Blue",
                "value": HeightSource.B,
            },
        ],
    )


def NormalChannelInvertInput() -> DropDownInput:
    return DropDownInput(
        input_type="NormalChannelInvert",
        label="Invert",
        options=[
            {
                "option": "None",
                "value": 0,
            },
            {
                "option": "Invert R",
                "value": 1,
            },
            {
                "option": "Invert G",
                "value": 2,
            },
            {
                "option": "Invert R and G",
                "value": 3,
            },
        ],
    )


def NormalMappingAlphaInput() -> DropDownInput:
    return DropDownInput(
        input_type="NormalMappingAlpha",
        label="Alpha Channel",
        options=[
            {
                "option": "None",
                "value": "none",
                "type": "NormalMappingAlpha::None",
            },
            {
                "option": "Unchanged",
                "value": "unchanged",
                "type": "NormalMappingAlpha::Unchanged",
            },
            {
                "option": "Height",
                "value": "height",
                "type": "NormalMappingAlpha::Height",
            },
            {
                "option": "Set to 1",
                "value": "one",
                "type": "NormalMappingAlpha::One",
            },
        ],
    )
