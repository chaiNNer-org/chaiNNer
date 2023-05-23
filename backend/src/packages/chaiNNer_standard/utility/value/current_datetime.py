from __future__ import annotations

import datetime
from enum import Enum
from typing import Dict

from nodes.properties.inputs import AnyInput, DateTimeFormatInput, EnumInput, TextInput
from nodes.properties.outputs import TextOutput

from .. import value_group


class DTFormatEnum(Enum):
    NUMBER = "number"
    LOCAL = f"%c"
    YEAR_MONTH_DAY = f"%Y-%m-%d"
    TIME = f"%H:%M:%S"
    ISO = "iso8601"


DT_FORMAT_LABEL: Dict[DTFormatEnum, str] = {
    DTFormatEnum.NUMBER: "Number",
    DTFormatEnum.LOCAL: "Local",
    DTFormatEnum.YEAR_MONTH_DAY: "Year-Month-Day",
    DTFormatEnum.TIME: "Hours-Mins-Sec",
    DTFormatEnum.ISO: "ISO 8601",
}


@value_group.register(
    schema_id="jackcarey:utility:current_datetime",
    name="Current Datetime",
    description="Outputs the current date and time as a string",
    icon="🕒",
    inputs=[
        EnumInput(
            DTFormatEnum,
            "Format",
            option_labels=DT_FORMAT_LABEL,
            default_value=DTFormatEnum.NUMBER,
        ),
        DateTimeFormatInput(
            "Custom format", has_handle=False, min_length=2, placeholder="Year:%yyyy"
        ).make_optional(),
        AnyInput("Trigger Update").make_optional(),
    ],
    outputs=[
        TextOutput("Datetieme String"),
    ],
)
def current_datetime_node(
    format: DTFormatEnum, customFormat: str, triggerUpdate
) -> str:
    now = datetime.datetime.now()
    if not customFormat:
        if format == DTFormatEnum.NUMBER:
            return str(now.timestamp())
        elif format == DTFormatEnum.ISO:
            return str(now.isoformat())
        else:
            return now.strftime(format)
    else:
        return now.strftime(customFormat)
