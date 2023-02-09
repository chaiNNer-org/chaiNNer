import math
import numpy as np


def horizontal_gradient(img: np.ndarray):
    x = np.arange(img.shape[1])
    p = x / (img.shape[1] - 1)
    img[:, :] = p.reshape((1, -1))


def vertical_gradient(img: np.ndarray):
    x = np.arange(img.shape[0])
    p = x / (img.shape[0] - 1)
    img[:, :] = p.reshape((-1, 1))


def diagonal_gradient(img: np.ndarray):
    diagonal = np.array(img.shape[:2], dtype="float32")
    diagonal_length = np.sqrt(np.sum(diagonal**2))
    diagonal /= diagonal_length

    pixels = np.array(
        [[(r, c) for r in range(img.shape[0]) for c in range(img.shape[1])]]
    )
    projection = pixels.dot(diagonal)
    p = (projection / (diagonal_length - np.sqrt(2))).ravel()
    img[:] = p.reshape(img.shape)


def radial_gradient(
    img: np.ndarray, inner_radius_percent: float = 0, outer_radius_percent: float = 1
):
    inner_radius = inner_radius_percent * img.shape[1] / 2
    outer_radius = outer_radius_percent * img.shape[1] / 2

    center = np.array(img.shape[:2], dtype="float32") / 2
    pixels = np.array(
        [(r, c) for r in range(img.shape[0]) for c in range(img.shape[1])]
    )
    distance = np.sqrt(np.sum((pixels - center) ** 2, axis=1))
    p = (distance - inner_radius) / (outer_radius - inner_radius)
    img[:] = p.reshape(img.shape)


def conic_gradient(img: np.ndarray, rotation: float = 0):
    if rotation > np.pi:
        rotation -= 2 * np.pi
    if rotation < -np.pi:
        rotation += 2 * np.pi

    center = np.array(img.shape[:2], dtype="float32") / 2
    pixels = np.array(
        [(r, c) for r in range(img.shape[0]) for c in range(img.shape[1])]
    )
    angles = np.arctan2(pixels[:, 0] - center[0], pixels[:, 1] - center[1]) + rotation
    angles[angles < 0] += 2 * np.pi
    p = angles / math.pi / 2
    img[:] = p.reshape(img.shape)
