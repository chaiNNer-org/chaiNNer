from __future__ import annotations

from enum import Enum

from nodes.properties.inputs import EnumInput
from nodes.properties.outputs import NumberOutput

from .. import value_group


class ResList(Enum):
    HD_1080 = "HD_1080"
    NTSC_MPEG2 = "NTSC MPEG2"
    NTSC_DV = "NTSC_DV"
    NTSC = "NTSC"
    PAL = "PAL"
    PAL_MPEG2 = "PAL MPEG2"
    HD_720 = "HD_720"
    UHD_4K = "UHD_4K"
    UHD2_8K = "UHD2_8K"
    DCI_2KFLAT = "DCI_2KFLAT"
    DCI_2KSCOPE = "DCI_2KSCOPE"
    DCI_2KFULL = "DCI_2K1080"
    DCI_4KFLAT = "DCI_4KFLAT"
    DCI_4KSCOPE = "DCI_4KSCOPE"
    DCI_4KFULL = "DCI_4K2160"
    SQ256 = "SQ256"
    SQ512 = "SQ512"
    SQ1024 = "SQ1024"
    SQ2048 = "SQ2048"
    SQ4096 = "SQ4096"
    SQ8192 = "SQ8192"


@value_group.register(
    schema_id="chainner:utility:formats",
    name="Formats",
    description="Industry formats.",
    icon="BsBadgeHd",
    inputs=[
        EnumInput(
            ResList,
            label="Resolution Presets",
            default=ResList.HD_1080,
            option_labels={
                ResList.HD_1080: "HD 1080P 1920x1080",
                ResList.NTSC_MPEG2: "SD NTSC MPEG-2 DVD 704x480",
                ResList.NTSC: "SD NTSC 720x486",
                ResList.NTSC_DV: "SD NTSC DV 720x480",
                ResList.PAL: "SD PAL 720x576",
                ResList.PAL_MPEG2: "SD PAL MPEG-2 DVD 702x576",
                ResList.HD_720: "HD 720P 1280x720",
                ResList.UHD_4K: "UHD 4K 3840x2160",
                ResList.UHD2_8K: "UHD2 8K 7680x4320",
                ResList.DCI_2KFLAT: "2K DCI FLAT 1998x1080",
                ResList.DCI_2KSCOPE: "2K DCI SCOPE 2048x858",
                ResList.DCI_2KFULL: "2K DCI FULL 2048x1080",
                ResList.DCI_4KFULL: "4K DCI FULL 4096x2160",
                ResList.DCI_4KFLAT: "4K DCI FLAT 3996x2160",
                ResList.DCI_4KSCOPE: "4K DCI SCOPE 4096x1716",
                ResList.SQ256: "Square 256x256",
                ResList.SQ512: "Square 512x512",
                ResList.SQ1024: "Square 1024x1024",
                ResList.SQ2048: "Square 2048x2048",
                ResList.SQ4096: "Square 4096x4096",
                ResList.SQ8192: "Square 8192x8192",
            },
        ),
    ],
    outputs=[
        NumberOutput("Width", output_type="int(1..)"),
        NumberOutput("Height", output_type="int(1..)"),
    ],
)
def formats_node(resolution_presets: ResList) -> tuple[int, int]:
    if resolution_presets == ResList.HD_1080:
        return 1920, 1080
    elif resolution_presets == ResList.NTSC_MPEG2:
        return 704, 480
    elif resolution_presets == ResList.NTSC:
        return 720, 486
    elif resolution_presets == ResList.NTSC_DV:
        return 720, 480
    elif resolution_presets == ResList.PAL:
        return 720, 576
    elif resolution_presets == ResList.PAL_MPEG2:
        return 702, 576
    elif resolution_presets == ResList.HD_720:
        return 1280, 720
    elif resolution_presets == ResList.UHD_4K:
        return 3840, 2160
    elif resolution_presets == ResList.UHD2_8K:
        return 7680, 4320
    elif resolution_presets == ResList.DCI_2KFULL:
        return 2048, 1080
    elif resolution_presets == ResList.DCI_2KFLAT:
        return 1998, 1080
    elif resolution_presets == ResList.DCI_2KSCOPE:
        return 2048, 858
    elif resolution_presets == ResList.DCI_4KFULL:
        return 4096, 2160
    elif resolution_presets == ResList.DCI_4KFLAT:
        return 3996, 2160
    elif resolution_presets == ResList.DCI_4KSCOPE:
        return 4096, 1716
    elif resolution_presets == ResList.SQ256:
        return 256, 256
    elif resolution_presets == ResList.SQ512:
        return 512, 512
    elif resolution_presets == ResList.SQ1024:
        return 1024, 1024
    elif resolution_presets == ResList.SQ2048:
        return 2048, 2048
    elif resolution_presets == ResList.SQ4096:
        return 4096, 4096
    elif resolution_presets == ResList.SQ8192:
        return 8192, 8192
    else:
        return 1920, 1080
