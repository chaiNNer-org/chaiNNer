from typing import Literal
import numpy as np

from .utils import get_h_w_c
from .image_utils import as_target_channels

# Applies gaussian noise to an image
def gaussian_noise(
    image: np.ndarray, amount: float, noise_type: Literal["gray", "rgb"] = "rgb"
) -> np.ndarray:
    img = image
    h, w, c = get_h_w_c(img)
    if noise_type == "rgb":
        img = as_target_channels(img, 3)
        c = 3
    noise = np.random.normal(0, amount, (h, w, c if noise_type == "rgb" else 1))
    if noise_type == "gray" and c == 3:
        noise = as_target_channels(noise, 3)
    return np.clip(img + noise, 0, 1)


# Applies uniform noise to an image
def uniform_noise(
    image: np.ndarray, amount: float, noise_type: Literal["gray", "rgb"] = "rgb"
) -> np.ndarray:
    img = image
    h, w, c = get_h_w_c(img)
    if noise_type == "rgb":
        img = as_target_channels(img, 3)
        c = 3
    noise = np.random.uniform(-amount, amount, (h, w, c if noise_type == "rgb" else 1))
    if noise_type == "gray" and c == 3:
        noise = as_target_channels(noise, 3)
    return np.clip(img + noise, 0, 1)


# Applies salt and pepper noise to an image
def salt_and_pepper_noise(
    image: np.ndarray, amount: float, noise_type: Literal["gray", "rgb"] = "rgb"
) -> np.ndarray:
    img = image
    h, w, c = get_h_w_c(img)
    if noise_type == "rgb":
        img = as_target_channels(img, 3)
        c = 3
    amt = amount / 2
    pepper = np.random.choice(
        [0, 1], (h, w, c if noise_type == "rgb" else 1), p=[amt, 1 - amt]
    )
    salt = np.random.choice(
        [0, 1], (h, w, c if noise_type == "rgb" else 1), p=[1 - amt, amt]
    )
    if noise_type == "gray" and c == 3:
        pepper = as_target_channels(pepper, 3)
        salt = as_target_channels(salt, 3)

    return np.clip(np.where(salt == 1, 1, np.where(pepper == 0, 0, img)), 0, 1)


# Applies poisson noise to an image
def poisson_noise(
    image: np.ndarray, amount: float, noise_type: Literal["gray", "rgb"] = "rgb"
) -> np.ndarray:
    img = image
    h, w, c = get_h_w_c(img)
    if noise_type == "rgb":
        img = as_target_channels(img, 3)
        c = 3
    noise = np.random.poisson(amount, (h, w, c if noise_type == "rgb" else 1))
    if noise_type == "gray" and c == 3:
        noise = as_target_channels(noise, 3)
    return np.clip(img + noise, 0, 1)


# Applies speckle noise to an image
def speckle_noise(
    image: np.ndarray, amount: float, noise_type: Literal["gray", "rgb"] = "rgb"
) -> np.ndarray:
    img = image
    h, w, c = get_h_w_c(img)
    if noise_type == "rgb":
        img = as_target_channels(img, 3)
        c = 3
    noise = np.random.normal(0, amount, (h, w, c if noise_type == "rgb" else 1))
    if noise_type == "gray" and c == 3:
        noise = as_target_channels(noise, 3)
    noise = noise.reshape(h, w, c)
    return np.clip(img + img * noise, 0, 1)
