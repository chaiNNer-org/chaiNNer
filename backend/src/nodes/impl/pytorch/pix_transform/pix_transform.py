from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
import torch
import torch.utils.data
from torch import optim

from .pix_transform_net import PixTransformNet


@dataclass
class Params:
    spatial_features_input: bool = True
    # spatial color head
    weights_regularizer: tuple[float, float, float] | None = (0.0001, 0.001, 0.001)
    loss: Literal["mse", "l1"] = "l1"
    lr: float = 0.001
    batch_size: int = 32
    iteration: int = 32 * 1024


def pix_transform(
    source_img: np.ndarray,
    guide_img: np.ndarray,
    device: torch.device,
    params: Params,
) -> np.ndarray:
    if len(guide_img.shape) < 3:
        guide_img = np.expand_dims(guide_img, 0)

    _n_channels, hr_height, hr_width = guide_img.shape

    source_img = source_img.squeeze()
    lr_height, lr_width = source_img.shape

    assert hr_height == hr_width
    assert lr_height == lr_width
    assert hr_height % lr_height == 0

    d = hr_height // lr_height
    m = lr_height
    _n = hr_height

    # normalize guide and source
    guide_img = (
        guide_img - np.mean(guide_img, axis=(1, 2), keepdims=True)
    ) / np.maximum(0.0001, np.std(guide_img, axis=(1, 2), keepdims=True))

    source_img_mean = np.mean(source_img)
    source_img_std = np.std(source_img)
    source_img = (source_img - source_img_mean) / np.maximum(0.0001, source_img_std)

    if params.spatial_features_input:
        x = np.linspace(-0.5, 0.5, hr_width)
        x_grid, y_grid = np.meshgrid(x, x, indexing="ij")

        x_grid = np.expand_dims(x_grid, axis=0)
        y_grid = np.expand_dims(y_grid, axis=0)

        guide_img = np.concatenate([guide_img, x_grid, y_grid], axis=0)

    #### prepare_patches #########################################################################
    # guide_patches is M^2 x C x D x D
    # source_pixels is M^2 x 1

    guide_tensor = torch.from_numpy(guide_img).float().to(device)
    source_tensor = torch.from_numpy(source_img).float().to(device)

    guide_patches = torch.zeros((m * m, guide_tensor.shape[0], d, d)).to(device)
    source_pixels = torch.zeros((m * m, 1)).to(device)
    for i in range(m):
        for j in range(m):
            guide_patches[j + i * m, :, :, :] = guide_tensor[
                :, i * d : (i + 1) * d, j * d : (j + 1) * d
            ]
            source_pixels[j + i * m] = source_tensor[i : (i + 1), j : (j + 1)]

    train_data = torch.utils.data.TensorDataset(guide_patches, source_pixels)
    train_loader = torch.utils.data.DataLoader(
        train_data, batch_size=params.batch_size, shuffle=True
    )
    ###############################################################################################

    #### setup network ############################################################################
    mynet = (
        PixTransformNet(
            channels_in=guide_tensor.shape[0],
            weights_regularizer=params.weights_regularizer,
        )
        .train()
        .to(device)
    )
    optimizer = optim.Adam(mynet.params_with_regularizer, lr=params.lr)
    if params.loss == "mse":
        myloss = torch.nn.MSELoss()
    elif params.loss == "l1":
        myloss = torch.nn.L1Loss()
    else:
        raise AssertionError("unknown loss!")
    ###############################################################################################

    epochs = params.batch_size * params.iteration // (m * m)
    for _epoch in range(epochs):
        for x, y in train_loader:
            optimizer.zero_grad()

            y_pred = mynet(x)
            y_mean_pred = torch.mean(y_pred, dim=[2, 3])

            source_patch_consistency = myloss(y_mean_pred, y)

            source_patch_consistency.backward()
            optimizer.step()

    # compute final prediction, un-normalize, and back to numpy
    mynet.eval()
    predicted_target_img = mynet(guide_tensor.unsqueeze(0)).squeeze()
    predicted_target_img = source_img_mean + source_img_std * predicted_target_img
    predicted_target_img = predicted_target_img.cpu().detach().squeeze().numpy()

    return predicted_target_img
