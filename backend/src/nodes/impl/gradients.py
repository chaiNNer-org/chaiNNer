import math
import numpy as np


def _interpolate(color1: np.ndarray, color2: np.ndarray, color3: np.ndarray, p: float,
                 middle_position: float) -> np.ndarray:
    if p <= middle_position and middle_position > 0:
        q = p / middle_position
        return color1 * (1 - q) + color2 * q
    else:
        q = (p - middle_position) / (1 - middle_position)
        return color2 * (1 - q) + color3 * q


def _interpolate_vector(color1: np.ndarray, color2: np.ndarray, color3: np.ndarray, ps: np.ndarray,
                 middle_position: float) -> np.ndarray:
    if middle_position == 0:
        color = np.outer((1-ps), color2) + np.outer(ps, color3)
        color[ps < 0] = color1
        return color
    if middle_position == 1:
        color = np.outer((1-ps), color1) + np.outer(ps, color2)
        color[ps>1] = color3
        return color
    p1 = ps/middle_position
    color = np.outer((1-p1), color1) + np.outer(p1, color2)
    mask = ps > middle_position
    p2 = (ps-middle_position)/(1-middle_position)
    color[mask,:] = (np.outer((1-p2), color2) + np.outer(p2, color3))[mask,:]
    return color


def horizontal_gradient(img: np.ndarray, color1: np.ndarray, color2: np.ndarray, color3: np.ndarray,
                        middle_position: float):
    if img.shape[1] == 1:
        img[:,:] = color2
    x = np.arange(img.shape[1])
    p = x / (img.shape[1]-1)
    img[:, :] = _interpolate_vector(color1, color2, color3, p, middle_position).reshape((1,-1,img.shape[2]))


def vertical_gradient(img: np.ndarray, color1: np.ndarray, color2: np.ndarray, color3: np.ndarray,
                      middle_position: float):
    if img.shape[0] == 1:
        img[:,:] = color2
    x = np.arange(img.shape[0])
    p = x / (img.shape[0]-1)
    img[:, :] = _interpolate_vector(color1, color2, color3, p, middle_position).reshape((-1,1,img.shape[2]))


def diagonal_gradient(img: np.ndarray, color1: np.ndarray, color2: np.ndarray, color3: np.ndarray,
                      middle_position: float):
    diagonal = np.array(img.shape[:2], dtype="float32")
    diagonal_length = np.sqrt(np.sum(diagonal ** 2))
    diagonal /= diagonal_length

    pixels = np.array([[(r,c) for r in range(img.shape[0]) for c in range(img.shape[1])]])
    projection = pixels.dot(diagonal)
    p = (projection / (diagonal_length - np.sqrt(2))).ravel()
    color = _interpolate_vector(color1, color2, color3, p, middle_position)

    img[:] = color.reshape(img.shape)


def radial_gradient(img: np.ndarray, color1: np.ndarray, color2: np.ndarray, color3: np.ndarray,
                    middle_position: float):
    inner_radius = 0 # TODO parameterize radii
    outer_radius = img.shape[1] / 2

    center = np.array(img.shape[:2], dtype="float32") / 2
    pixels = np.array([(r,c) for r in range(img.shape[0]) for c in range(img.shape[1])])
    distance = np.sqrt(np.sum((pixels-center)**2, axis=1))
    p = (distance-inner_radius)/(outer_radius-inner_radius)
    color = _interpolate_vector(color1, color2, color3, p, middle_position)
    img[:] = color.reshape(img.shape)


def conic_gradient(img: np.ndarray, color1: np.ndarray, color2: np.ndarray, color3: np.ndarray, middle_position: float):
    # TODO rotation parameter
    rotation = 0  # [-pi,pi]

    center = np.array(img.shape[:2], dtype="float32") / 2
    pixels = np.array([(r,c) for r in range(img.shape[0]) for c in range(img.shape[1])])
    angles = np.arctan2(pixels[:,0]-center[0], pixels[:,1]-center[1]) + rotation
    angles[angles<0] += 2*np.pi
    p = angles / math.pi / 2
    color = _interpolate_vector(color1, color2, color3, p, middle_position)
    img[:] = color.reshape(img.shape)