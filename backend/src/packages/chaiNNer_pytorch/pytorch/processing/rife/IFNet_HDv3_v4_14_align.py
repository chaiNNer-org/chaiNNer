
# Original Rife Frame Interpolation by hzwer
# https://github.com/megvii-research/ECCV2022-RIFE
# https://github.com/hzwer/Practical-RIFE

# Modifications to use Rife for Image Alignment by tepete ('Enhance Everything!' Discord Server)

# Additional helpful github issues
# https://github.com/megvii-research/ECCV2022-RIFE/issues/278
# https://github.com/megvii-research/ECCV2022-RIFE/issues/344

import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.transforms as transforms
from .warplayer import warp

def conv(in_planes, out_planes, kernel_size=3, stride=1, padding=1, dilation=1):
    return nn.Sequential(
        nn.Conv2d(in_planes, out_planes, kernel_size=kernel_size, stride=stride,
                  padding=padding, dilation=dilation, bias=True),        
        nn.LeakyReLU(0.2, True)
    )

def conv_bn(in_planes, out_planes, kernel_size=3, stride=1, padding=1, dilation=1):
    return nn.Sequential(
        nn.Conv2d(in_planes, out_planes, kernel_size=kernel_size, stride=stride,
                  padding=padding, dilation=dilation, bias=False),
        nn.BatchNorm2d(out_planes),
        nn.LeakyReLU(0.2, True)
    )
    
class Head(nn.Module):
    def __init__(self):
        super(Head, self).__init__()
        self.cnn0 = nn.Conv2d(3, 32, 3, 2, 1)
        self.cnn1 = nn.Conv2d(32, 32, 3, 1, 1)
        self.cnn2 = nn.Conv2d(32, 32, 3, 1, 1)
        self.cnn3 = nn.ConvTranspose2d(32, 8, 4, 2, 1)
        self.relu = nn.LeakyReLU(0.2, True)

    def forward(self, x, feat=False):
        x0 = self.cnn0(x)
        x = self.relu(x0)
        x1 = self.cnn1(x)
        x = self.relu(x1)
        x2 = self.cnn2(x)
        x = self.relu(x2)
        x3 = self.cnn3(x)
        if feat:
            return [x0, x1, x2, x3]
        return x3

class ResConv(nn.Module):
    def __init__(self, c, dilation=1):
        super(ResConv, self).__init__()
        self.conv = nn.Conv2d(c, c, 3, 1, dilation, dilation=dilation, groups=1\
)
        self.beta = nn.Parameter(torch.ones((1, c, 1, 1)), requires_grad=True)
        self.relu = nn.LeakyReLU(0.2, True)

    def forward(self, x):
        return self.relu(self.conv(x) * self.beta + x)

class IFBlock(nn.Module):
    def __init__(self, in_planes, c=64):
        super(IFBlock, self).__init__()
        self.conv0 = nn.Sequential(
            conv(in_planes, c//2, 3, 2, 1),
            conv(c//2, c, 3, 2, 1),
            )
        self.convblock = nn.Sequential(
            ResConv(c),
            ResConv(c),
            ResConv(c),
            ResConv(c),
            ResConv(c),
            ResConv(c),
            ResConv(c),
            ResConv(c),
        )
        self.lastconv = nn.Sequential(
            nn.ConvTranspose2d(c, 4*6, 4, 2, 1),
            nn.PixelShuffle(2)
        )

    def forward(self, x, flow=None, scale=1):
        x = F.interpolate(x, scale_factor= 1. / scale, mode="bilinear", align_corners=False)
        if flow is not None:
            flow = F.interpolate(flow, scale_factor= 1. / scale, mode="bilinear", align_corners=False) * 1. / scale
            x = torch.cat((x, flow), 1)
        feat = self.conv0(x)
        feat = self.convblock(feat)
        tmp = self.lastconv(feat)
        tmp = F.interpolate(tmp, scale_factor=scale, mode="bilinear", align_corners=False)
        flow = tmp[:, :4] * scale
        mask = tmp[:, 4:5]
        return flow, mask

class IFNet(nn.Module):
    def __init__(self):
        super(IFNet, self).__init__()
        self.block0 = IFBlock(7+16, c=192)
        self.block1 = IFBlock(8+4+16, c=128)
        self.block2 = IFBlock(8+4+16, c=96)
        self.block3 = IFBlock(8+4+16, c=64)
        self.encode = Head()

    def align_images(self, img0, img1, timestep, scale_list, blur_strength, ensemble, device):
        #optional blur
        if blur_strength is not None and blur_strength > 0:
            blur = transforms.GaussianBlur(kernel_size=(5, 5), sigma=(blur_strength, blur_strength))
            img0_blurred = blur(img0)
            img1_blurred = blur(img1)
        else:
            img0_blurred = img0
            img1_blurred = img1

        f0 = self.encode(img0_blurred[:, :3])
        f1 = self.encode(img1_blurred[:, :3])
        flow_list = []
        mask_list = []
        flow = None
        mask = None
        block = [self.block0, self.block1, self.block2, self.block3]
        for i in range(4):
            if flow is None:
                flow, mask = block[i](torch.cat((img0_blurred[:, :3], img1_blurred[:, :3], f0, f1, timestep), 1), None, scale=scale_list[i])
                if ensemble:
                    f_, m_ = block[i](torch.cat((img1_blurred[:, :3], img0_blurred[:, :3], f1, f0, 1-timestep), 1), None, scale=scale_list[i])
                    flow = (flow + torch.cat((f_[:, 2:4], f_[:, :2]), 1)) / 2
                    mask = (mask + (-m_)) / 2
            else:
                wf0 = warp(f0, flow[:, :2], device)
                wf1 = warp(f1, flow[:, 2:4], device)
                fd, m0 = block[i](torch.cat((img0_blurred[:, :3], img1_blurred[:, :3], wf0, wf1, timestep, mask), 1), flow, scale=scale_list[i])
                if ensemble:
                    f_, m_ = block[i](torch.cat((img1_blurred[:, :3], img0_blurred[:, :3], wf1, wf0, 1-timestep, -mask), 1), torch.cat((flow[:, 2:4], flow[:, :2]), 1), scale=scale_list[i])
                    fd = (fd + torch.cat((f_[:, 2:4], f_[:, :2]), 1)) / 2
                    mask = (m0 + (-m_)) / 2
                else:
                    mask = m0
                flow = flow + fd
            mask_list.append(mask)
            flow_list.append(flow)

        #apply warp to original image
        aligned_img0 = warp(img0, flow_list[-1][:, :2], device)
        
        #add clamp here instead of in warplayer script, as it changes the output there
        aligned_img0 = aligned_img0.clamp(min=0.0, max=1.0)
        return aligned_img0, flow_list[-1]

    def forward(self, x, timestep=1, training=False, fastmode=True, ensemble=True, num_iterations=1, multiplier=0.5, blur_strength=0, device='cuda'):
        if not training:
            channel = x.shape[1] // 2
            img0 = x[:, :channel]
            img1 = x[:, channel:]
        
        scale_list = [multiplier * 8, multiplier * 4, multiplier * 2, multiplier]

        if not torch.is_tensor(timestep):
            timestep = (x[:, :1].clone() * 0 + 1) * timestep
        else:
            timestep = timestep.repeat(1, 1, img0.shape[2], img0.shape[3])

        for iteration in range(num_iterations):
            aligned_img0, flow = self.align_images(img0, img1, timestep, scale_list, blur_strength, ensemble, device)
            img0 = aligned_img0  #use the aligned image as img0 for the next iteration

        return aligned_img0, flow
