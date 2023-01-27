import numpy as np
from ..image_utils import MAX_VALUES_BY_DTYPE


def dtype_to_float(image: np.ndarray) -> np.ndarray:
    max_value = MAX_VALUES_BY_DTYPE.get(image.dtype, 1.0)
    return image.astype(np.dtype("float32")) / max_value


def float_to_dtype(image: np.ndarray, dtype: np.dtype) -> np.ndarray:
    max_value = MAX_VALUES_BY_DTYPE.get(dtype, 1.0)
    return (image * max_value).astype(dtype)



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


