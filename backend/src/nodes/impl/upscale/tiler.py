from abc import ABC, abstractmethod

from ...utils.utils import Size


class Tiler(ABC):
    @abstractmethod
    def allow_smaller_tile_size(self) -> bool:
        """
        Whether the split implementation may use tile sizes smaller than the ones returned by this tiler.

        If False, then the split implementation guarantees that the all tiles are of exactly the size returned by this tiler.
        If the image is smaller than the returned tile size, then it has to be padded to reach the given size.
        """

    @abstractmethod
    def starting_tile_size(self, width: int, height: int, channels: int) -> Size:
        """
        The starting tile size is the first tile size that will be used.

        We generally prefer square tile sizes, but any tile size may be used.
        """

    def split(self, tile_size: Size) -> Size:
        w, h = tile_size
        assert w >= 16 and h >= 16
        return max(16, w // 2), max(16, h // 2)


class NoTiling(Tiler):
    def allow_smaller_tile_size(self) -> bool:
        return True

    def starting_tile_size(self, width: int, height: int, _channels: int) -> Size:
        size = max(width, height)
        # we prefer square tiles
        return size, size

    def split(self, _: Size) -> Size:
        raise ValueError("Image cannot be upscale with No Tiling mode.")


class MaxTileSize(Tiler):
    def __init__(self, tile_size: int = 2**31) -> None:
        self.tile_size: int = tile_size

    def allow_smaller_tile_size(self) -> bool:
        return True

    def starting_tile_size(self, width: int, height: int, _channels: int) -> Size:
        # Tile size a lot larger than the image don't make sense.
        # So we use the minimum of the image dimensions and the given tile size.
        max_tile_size = max(width + 10, height + 10)
        size = min(self.tile_size, max_tile_size)
        return size, size


class ExactTileSize(Tiler):
    def __init__(self, exact_size: Size) -> None:
        self.exact_size = exact_size

    def allow_smaller_tile_size(self) -> bool:
        return False

    def starting_tile_size(self, _width: int, _height: int, _channels: int) -> Size:
        return self.exact_size

    def split(self, _tile_size: Size) -> Size:
        raise ValueError(
            f"Splits are not supported for exact size ({self.exact_size[0]}x{self.exact_size[1]}px) splitting."
            f" This typically means that your machine does not have enough VRAM to run the current model."
        )
