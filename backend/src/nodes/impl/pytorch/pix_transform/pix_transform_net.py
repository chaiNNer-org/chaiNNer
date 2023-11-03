from __future__ import annotations

import torch.nn as nn


class PixTransformNet(nn.Module):
    def __init__(
        self,
        channels_in: int = 5,
        kernel_size: int = 1,
        weights_regularizer: tuple[float, float, float] | None = None,
    ):
        super().__init__()

        self.channels_in = channels_in

        self.spatial_net = nn.Sequential(
            nn.Conv2d(2, 32, (1, 1), padding=0),
            nn.ReLU(),
            nn.Conv2d(
                32, 2048, (kernel_size, kernel_size), padding=(kernel_size - 1) // 2
            ),
        )
        self.color_net = nn.Sequential(
            nn.Conv2d(channels_in - 2, 32, (1, 1), padding=0),
            nn.ReLU(),
            nn.Conv2d(
                32, 2048, (kernel_size, kernel_size), padding=(kernel_size - 1) // 2
            ),
        )
        self.head_net = nn.Sequential(
            nn.ReLU(),
            nn.Conv2d(
                2048, 32, (kernel_size, kernel_size), padding=(kernel_size - 1) // 2
            ),
            nn.ReLU(),
            nn.Conv2d(32, 1, (1, 1), padding=0),
        )

        if weights_regularizer is None:
            reg_spatial = 0.0001
            reg_color = 0.001
            reg_head = 0.0001
        else:
            reg_spatial = weights_regularizer[0]
            reg_color = weights_regularizer[1]
            reg_head = weights_regularizer[2]

        self.params_with_regularizer = []
        self.params_with_regularizer += [
            {"params": self.spatial_net.parameters(), "weight_decay": reg_spatial}
        ]
        self.params_with_regularizer += [
            {"params": self.color_net.parameters(), "weight_decay": reg_color}
        ]
        self.params_with_regularizer += [
            {"params": self.head_net.parameters(), "weight_decay": reg_head}
        ]

    def forward(self, input_):
        input_spatial = input_[:, self.channels_in - 2 :, :, :]
        input_color = input_[:, 0 : self.channels_in - 2, :, :]

        merged_features = self.spatial_net(input_spatial) + self.color_net(input_color)

        return self.head_net(merged_features)
