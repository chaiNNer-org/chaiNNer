from dataclasses import dataclass, field
from typing import Callable, Dict, Generic, Iterable, List, Set, Tuple, TypeVar, Union
import numpy as np
from sanic.log import logger

from .convert_data import conversions, color_spaces
from .convert_model import (
    ColorSpace,
    Conversion,
    assert_input_channels,
    assert_output_channels,
)


def color_space_from_id(id: int) -> ColorSpace:
    for c in color_spaces:
        if c.id == id:
            return c
    raise ValueError(f"There is no color space with the id {id}.")


T = TypeVar("T")


@dataclass(order=True)
class __ProcessingItem(Generic[T]):
    cost: int
    path: List[T] = field(compare=False)


def get_shortest_path(
    start: T,
    is_destination: Callable[[T], bool],
    get_next: Callable[[T], Iterable[Tuple[int, T]]],
) -> Union[List[T], None]:
    """A simple implementation of Dijkstra's"""

    processed: Set[T] = set()
    front: Dict[T, __ProcessingItem] = {
        start: __ProcessingItem(cost=0, path=[start]),
    }

    while len(front) > 0:
        min = None
        for x in front.values():
            if min is None:
                min = x
            elif x.cost < min.cost:
                min = x
        assert min is not None

        current = min.path[-1]
        del front[current]
        processed.add(current)

        if is_destination(current):
            return min.path

        for cost, to in get_next(current):
            cost = min.cost + cost
            old = front.get(to, None)
            if old is None:
                if to not in processed:
                    new_path = min.path.copy()
                    new_path.append(to)
                    front[to] = __ProcessingItem(cost=cost, path=new_path)
            else:
                if old.cost > cost:
                    old.cost = cost
                    old.path.clear()
                    old.path.extend(min.path)
                    old.path.append(to)


__conversions_map: Dict[ColorSpace, List[Conversion]] = {}
for conv in conversions:
    l = __conversions_map.get(conv.input, [])
    if len(l) == 0:
        __conversions_map[conv.input] = l
    l.append(conv)


def convert(img: np.ndarray, input: ColorSpace, output: ColorSpace) -> np.ndarray:
    assert_input_channels(img, input, output)

    if input == output:
        return img

    path = get_shortest_path(
        input,
        is_destination=lambda i: i == output,
        get_next=lambda i: [(c.cost, c.output) for c in __conversions_map.get(i, [])],
    )

    if path is None:
        raise ValueError(f"Conversion {input.name} -> {output.name} is not possible.")

    logger.info(
        f"Converting color using the path {' -> '.join(map(lambda x: x.name, path))}"
    )

    for i in range(1, len(path)):
        curr_in = path[i - 1]
        curr_out = path[i]

        conv = None
        for c in __conversions_map.get(curr_in, []):
            if c.output == curr_out:
                conv = c
                break
        assert conv is not None

        img = conv.convert(img)

    assert_output_channels(img, input, output)
    return img
