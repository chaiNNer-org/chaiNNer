"""
"XFeat: Accelerated Features for Lightweight Image Matching, CVPR 2024."
https://www.verlab.dcc.ufmg.br/descriptors/xfeat_cvpr24/
"""

import torch
import torch.nn.functional as f
from torch import nn


class BasicLayer(nn.Module):
    """
    Basic Convolutional Layer: Conv2d -> BatchNorm -> ReLU
    """

    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        kernel_size: int = 3,
        stride: int = 1,
        padding: int = 1,
        dilation: int = 1,
        bias: bool = False,
    ):
        super().__init__()
        self.layer = nn.Sequential(
            nn.Conv2d(
                in_channels,
                out_channels,
                kernel_size,
                padding=padding,
                stride=stride,
                dilation=dilation,
                bias=bias,
            ),
            nn.BatchNorm2d(out_channels, affine=False),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor):
        return self.layer(x)


class XFeatModel(nn.Module):
    """
    Implementation of architecture described in
    "XFeat: Accelerated Features for Lightweight Image Matching, CVPR 2024."
    """

    def __init__(self):
        super().__init__()
        self.norm = nn.InstanceNorm2d(1)

        ########### ⬇️ CNN Backbone & Heads ⬇️ ###########

        self.skip1 = nn.Sequential(
            nn.AvgPool2d(4, stride=4), nn.Conv2d(1, 24, 1, stride=1, padding=0)
        )

        self.block1 = nn.Sequential(
            BasicLayer(1, 4, stride=1),
            BasicLayer(4, 8, stride=2),
            BasicLayer(8, 8, stride=1),
            BasicLayer(8, 24, stride=2),
        )

        self.block2 = nn.Sequential(
            BasicLayer(24, 24, stride=1),
            BasicLayer(24, 24, stride=1),
        )

        self.block3 = nn.Sequential(
            BasicLayer(24, 64, stride=2),
            BasicLayer(64, 64, stride=1),
            BasicLayer(64, 64, 1, padding=0),
        )
        self.block4 = nn.Sequential(
            BasicLayer(64, 64, stride=2),
            BasicLayer(64, 64, stride=1),
            BasicLayer(64, 64, stride=1),
        )

        self.block5 = nn.Sequential(
            BasicLayer(64, 128, stride=2),
            BasicLayer(128, 128, stride=1),
            BasicLayer(128, 128, stride=1),
            BasicLayer(128, 64, 1, padding=0),
        )

        self.block_fusion = nn.Sequential(
            BasicLayer(64, 64, stride=1),
            BasicLayer(64, 64, stride=1),
            nn.Conv2d(64, 64, 1, padding=0),
        )

        self.heatmap_head = nn.Sequential(
            BasicLayer(64, 64, 1, padding=0),
            BasicLayer(64, 64, 1, padding=0),
            nn.Conv2d(64, 1, 1),
            nn.Sigmoid(),
        )

        self.keypoint_head = nn.Sequential(
            BasicLayer(64, 64, 1, padding=0),
            BasicLayer(64, 64, 1, padding=0),
            BasicLayer(64, 64, 1, padding=0),
            nn.Conv2d(64, 65, 1),
        )

        ########### ⬇️ Fine Matcher MLP ⬇️ ###########

        self.fine_matcher = nn.Sequential(
            nn.Linear(128, 512),
            nn.BatchNorm1d(512, affine=False),
            nn.ReLU(inplace=True),
            nn.Linear(512, 512),
            nn.BatchNorm1d(512, affine=False),
            nn.ReLU(inplace=True),
            nn.Linear(512, 512),
            nn.BatchNorm1d(512, affine=False),
            nn.ReLU(inplace=True),
            nn.Linear(512, 512),
            nn.BatchNorm1d(512, affine=False),
            nn.ReLU(inplace=True),
            nn.Linear(512, 64),
        )

    def _unfold2d(self, x: torch.Tensor, ws: int = 2):
        """
        Unfolds tensor in 2D with desired ws (window size) and concat the channels
        """
        b, c, h, w = x.shape
        x = x.unfold(2, ws, ws).unfold(3, ws, ws).reshape(b, c, h // ws, w // ws, ws**2)
        return x.permute(0, 1, 4, 2, 3).reshape(b, -1, h // ws, w // ws)

    def forward(self, x: torch.Tensor):
        """
        input:
                x -> torch.Tensor(B, C, H, W) grayscale or rgb images
        return:
                feats     ->  torch.Tensor(B, 64, H/8, W/8) dense local features
                keypoints ->  torch.Tensor(B, 65, H/8, W/8) keypoint logit map
                heatmap   ->  torch.Tensor(B,  1, H/8, W/8) reliability map

        """
        # dont backprop through normalization
        with torch.no_grad():
            x = x.mean(dim=1, keepdim=True)
            x = self.norm(x)

        # main backbone
        x1 = self.block1(x)
        x2 = self.block2(x1 + self.skip1(x))
        x3 = self.block3(x2)
        x4 = self.block4(x3)
        x5 = self.block5(x4)

        # pyramid fusion
        x4 = f.interpolate(x4, (x3.shape[-2], x3.shape[-1]), mode="bilinear")
        x5 = f.interpolate(x5, (x3.shape[-2], x3.shape[-1]), mode="bilinear")
        feats = self.block_fusion(x3 + x4 + x5)

        # heads
        heatmap = self.heatmap_head(feats)  # Reliability map
        keypoints = self.keypoint_head(self._unfold2d(x, ws=8))  # Keypoint map logits

        return feats, keypoints, heatmap
