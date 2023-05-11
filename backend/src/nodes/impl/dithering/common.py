import numpy as np

from ..image_utils import MAX_VALUES_BY_DTYPE


def dtype_convert(image: np.ndarray, target_dtype: np.dtype):
    if image.dtype == target_dtype:
        return image

    image = dtype_to_float(image)
    return float_to_dtype(image, target_dtype)


def dtype_to_float(image: np.ndarray) -> np.ndarray:
    if image.dtype == np.float32:
        return image
    max_value = MAX_VALUES_BY_DTYPE[image.dtype]
    return image.astype(np.float32) / max_value


def dtype_to_uint8(image: np.ndarray) -> np.ndarray:
    return dtype_convert(image, np.dtype("uint8"))


def float_to_dtype(image: np.ndarray, dtype: np.dtype) -> np.ndarray:
    if image.dtype == dtype:
        return image
    max_value = MAX_VALUES_BY_DTYPE[dtype]
    return (image * max_value).astype(dtype)


def apply_to_all_channels(
    one_channel_filter, image: np.ndarray, *args, **kwargs
) -> np.ndarray:
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
