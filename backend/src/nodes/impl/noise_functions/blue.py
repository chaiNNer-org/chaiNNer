# http://momentsingraphics.de/BlueNoise.html
# https://github.com/MomentsInGraphics/BlueNoise/blob/master/BlueNoise.py

from __future__ import annotations

import numpy as np
from scipy import ndimage


def find_largest_void(binary_pattern: np.ndarray, standard_deviation: float):
    """This function returns the indices of the largest void in the given binary
     pattern as defined by Ulichney.
    @param BinaryPattern A boolean array (should be two-dimensional although the
           implementation works in arbitrary dimensions).
    @param StandardDeviation The standard deviation used for the Gaussian filter
           in pixels. This can be a single float for an isotropic Gaussian or a
           tuple with one float per dimension for an anisotropic Gaussian.
    @return A flat index i such that BinaryPattern.flat[i] corresponds to the
            largest void. By definition this is a majority pixel.
    @sa GetVoidAndClusterBlueNoise"""
    # The minority value is always True for convenience
    if np.count_nonzero(binary_pattern) * 2 >= np.size(binary_pattern):
        binary_pattern = np.logical_not(binary_pattern)
    # Apply the Gaussian. We do not want to cut off the Gaussian at all because even
    # the tiniest difference can change the ranking. Therefore we apply the Gaussian
    # through a fast Fourier transform by means of the convolution theorem.
    filtered_array = np.fft.ifftn(
        ndimage.fourier.fourier_gaussian(
            np.fft.fftn(np.where(binary_pattern, 1.0, 0.0)), standard_deviation
        )
    ).real
    # Find the largest void
    return np.argmin(np.where(binary_pattern, 2.0, filtered_array))


def find_tightest_cluster(binary_pattern: np.ndarray, standard_deviation: float):
    """Like FindLargestVoid() but finds the tightest cluster which is a minority
     pixel by definition.
    @sa GetVoidAndClusterBlueNoise"""
    if np.count_nonzero(binary_pattern) * 2 >= np.size(binary_pattern):
        binary_pattern = np.logical_not(binary_pattern)
    filtered_array = np.fft.ifftn(
        ndimage.fourier.fourier_gaussian(
            np.fft.fftn(np.where(binary_pattern, 1.0, 0.0)), standard_deviation
        )
    ).real
    return np.argmax(np.where(binary_pattern, filtered_array, -1.0))


def create_blue_noise(
    output_shape: tuple[int, int],
    standard_deviation: float = 1.5,
    initial_seed_fraction: float = 0.1,
    seed: int = 0,
):
    """Generates a blue noise dither array of the given shape using the method
     proposed by Ulichney [1993] in "The void-and-cluster method for dither array
     generation" published in Proc. SPIE 1913.
    @param OutputShape The shape of the output array. This function works in
           arbitrary dimension, i.e. OutputShape can have arbitrary length. Though
           it is only tested for the 2D case where you should pass a tuple
           (Height,Width).
    @param StandardDeviation The standard deviation in pixels used for the
           Gaussian filter defining largest voids and tightest clusters. Larger
           values lead to more low-frequency content but better isotropy. Small
           values lead to more ordered patterns with less low-frequency content.
           Ulichney proposes to use a value of 1.5. If you want an anisotropic
           Gaussian, you can pass a tuple of length len(OutputShape) with one
           standard deviation per dimension.
    @param initial_seed_fraction The only non-deterministic step in the algorithm
           marks a small number of pixels in the grid randomly. This parameter
           defines the fraction of such points. It has to be positive but less
           than 0.5. Very small values lead to ordered patterns, beyond that there
           is little change.
    @return An integer array of shape OutputShape containing each integer from 0
            to np.prod(OutputShape)-1 exactly once."""
    n_rank = np.prod(output_shape)
    # Generate the initial binary pattern with a prescribed number of ones
    n_initial_one = max(
        1, min(int((n_rank - 1) / 2), int(n_rank * initial_seed_fraction))
    )
    # Start from white noise (this is the only randomized step)
    initial_binary_pattern = np.zeros(output_shape, dtype=np.bool_)
    initial_binary_pattern.flat = (
        np.random.default_rng(seed).permutation(np.arange(n_rank)) < n_initial_one
    )  # type:ignore
    # Swap ones from tightest clusters to largest voids iteratively until convergence
    while True:
        i_tightest_cluster = find_tightest_cluster(
            initial_binary_pattern, standard_deviation
        )
        initial_binary_pattern.flat[i_tightest_cluster] = False
        i_largest_void = find_largest_void(initial_binary_pattern, standard_deviation)
        if i_largest_void == i_tightest_cluster:
            initial_binary_pattern.flat[i_tightest_cluster] = True
            # Nothing has changed, so we have converged
            break
        else:
            initial_binary_pattern.flat[i_largest_void] = True
    # Rank all pixels
    dither_array = np.zeros(output_shape, dtype=np.int32)
    # Phase 1: Rank minority pixels in the initial binary pattern
    binary_pattern = np.copy(initial_binary_pattern)
    for rank in range(n_initial_one - 1, -1, -1):
        i_tightest_cluster = find_tightest_cluster(binary_pattern, standard_deviation)
        binary_pattern.flat[i_tightest_cluster] = False
        dither_array.flat[i_tightest_cluster] = rank
    # Phase 2: Rank the remainder of the first half of all pixels
    binary_pattern = initial_binary_pattern
    for rank in range(n_initial_one, int((n_rank + 1) / 2)):
        i_largest_void = find_largest_void(binary_pattern, standard_deviation)
        binary_pattern.flat[i_largest_void] = True
        dither_array.flat[i_largest_void] = rank
    # Phase 3: Rank the last half of pixels
    for rank in range(int((n_rank + 1) / 2), n_rank):
        i_tightest_cluster = find_tightest_cluster(binary_pattern, standard_deviation)
        binary_pattern.flat[i_tightest_cluster] = True
        dither_array.flat[i_tightest_cluster] = rank
    return dither_array
