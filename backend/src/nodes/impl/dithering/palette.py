import cv2
import numpy as np

from ..image_utils import as_3d
from .common import dtype_to_float


def distinct_colors_palette(image: np.ndarray) -> np.ndarray:
    image = as_3d(image)
    return np.unique(image.reshape((-1, image.shape[2])), axis=0).reshape(
        (1, -1, image.shape[2])
    )


def kmeans_palette(image: np.ndarray, num_colors: int) -> np.ndarray:
    image = as_3d(image)
    flat_image = dtype_to_float(image.reshape((-1, image.shape[2])))

    max_iter = 10
    epsilon = 1.0
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, max_iter, epsilon)

    attempts = 10
    cv2.setRNGSeed(0)
    _, _, center = cv2.kmeans(
        flat_image, num_colors, None, criteria, attempts, cv2.KMEANS_PP_CENTERS
    )

    return center.reshape((1, -1, image.shape[2]))


class MedianCutBucket:
    def __init__(self, data: np.ndarray):
        self.data = data
        self.n_pixels, self.n_channels = data.shape
        self.min_values = np.min(data, axis=0)
        self.max_values = np.max(data, axis=0)
        self.channel_ranges = self.max_values - self.min_values
        self.biggest_range = np.max(self.channel_ranges)

    def split(self):
        widest_channel = np.argmax(self.channel_ranges)
        median = np.median(self.data[:, widest_channel])
        mask = self.data[:, widest_channel] > median
        if mask.sum() == 0:
            mean = np.mean(self.data[:, widest_channel])
            mask = self.data[:, widest_channel] > mean
        return MedianCutBucket(self.data[mask == True]), MedianCutBucket(
            self.data[mask == False]
        )

    def average(self):
        return np.mean(self.data, axis=0)


def median_cut_palette(image: np.ndarray, num_colors: int) -> np.ndarray:
    image = as_3d(image)
    flat_image = dtype_to_float(image.reshape((-1, image.shape[2])))

    buckets = [MedianCutBucket(flat_image)]
    while len(buckets) < num_colors:
        bucket_idx, bucket = max(enumerate(buckets), key=lambda x: x[1].biggest_range)
        if bucket.biggest_range == 0:
            break
        buckets.pop(bucket_idx)

        buckets.extend(bucket.split())

    return np.stack([bucket.average() for bucket in buckets], axis=0).reshape(
        (1, -1, image.shape[2])
    )
