from typing import Callable, Iterable, List, Literal, TypeVar

T = TypeVar("T")
Conj = Literal["and", "or"]


def join_english(
    items: Iterable[T],
    to_str: Callable[[T], str] = str,
    conj: Conj = "and",
) -> str:
    s = list(map(to_str, items))

    l = len(s)
    assert l > 0

    if l == 1:
        return s[0]
    if l == 2:
        return f"{s[0]} {conj} {s[1]}"
    return ", ".join(s[:-1]) + f", {conj} " + s[-1]


def format_image_with_channels(
    channels: List[int],
    conj: Conj = "and",
    plural: bool = False,
) -> str:
    assert len(channels) > 0

    named = {1: "grayscale", 3: "RGB", 4: "RGBA"}
    if all([x in named for x in channels]):
        if plural:
            return join_english(channels, lambda c: named[c], conj=conj) + " images"
        else:
            return (
                "a " + join_english(channels, lambda c: named[c], conj=conj) + " image"
            )

    if plural:
        return f"images with {join_english(channels, conj=conj)} channel(s)"
    else:
        return f"an image with {join_english(channels, conj=conj)} channel(s)"


_CHANNEL_NUMBER_NAME = {1: "GRAY", 3: "RGB", 4: "RGBA"}


def format_channel_numbers(input_channels: int, output_channels: int) -> str:
    i = _CHANNEL_NUMBER_NAME.get(input_channels, str(input_channels))
    o = _CHANNEL_NUMBER_NAME.get(output_channels, str(output_channels))
    return f"{i}🠚{o}"
