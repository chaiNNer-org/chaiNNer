# type: ignore
# Original Rife Frame Interpolation by hzwer
# https://github.com/megvii-research/ECCV2022-RIFE
# https://github.com/hzwer/Practical-RIFE

# Modifications to use Rife for Image Alignment by pifroggi
# or tepete on the "Enhance Everything!" Discord Server
# https://github.com/pifroggi/vs_align

# Additional helpful github issues
# https://github.com/megvii-research/ECCV2022-RIFE/issues/278
# https://github.com/megvii-research/ECCV2022-RIFE/issues/344

from __future__ import annotations

import torch
from torch import nn
from torch.nn import functional
from torchvision import transforms

from .warplayer import warp


def conv(
    in_planes: int,
    out_planes: int,
    kernel_size: int = 3,
    stride: int = 1,
    padding: int = 1,
    dilation: int = 1,
):
    return nn.Sequential(
        nn.Conv2d(
            in_planes,
            out_planes,
            kernel_size=kernel_size,
            stride=stride,
            padding=padding,
            dilation=dilation,
            bias=True,
        ),
        nn.LeakyReLU(0.2, True),
    )


def conv_bn(
    in_planes: int,
    out_planes: int,
    kernel_size: int = 3,
    stride: int = 1,
    padding: int = 1,
    dilation: int = 1,
):
    return nn.Sequential(
        nn.Conv2d(
            in_planes,
            out_planes,
            kernel_size=kernel_size,
            stride=stride,
            padding=padding,
            dilation=dilation,
            bias=False,
        ),
        nn.BatchNorm2d(out_planes),
        nn.LeakyReLU(0.2, True),
    )


class Head(nn.Module):
    def __init__(self):
        super().__init__()
        self.cnn0 = nn.Conv2d(3, 32, 3, 2, 1)
        self.cnn1 = nn.Conv2d(32, 32, 3, 1, 1)
        self.cnn2 = nn.Conv2d(32, 32, 3, 1, 1)
        self.cnn3 = nn.ConvTranspose2d(32, 8, 4, 2, 1)
        self.relu = nn.LeakyReLU(0.2, True)

    def forward(self, x: torch.Tensor, feat: bool = False):
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
    def __init__(self, c: int, dilation: int = 1):
        super().__init__()
        self.conv = nn.Conv2d(c, c, 3, 1, dilation, dilation=dilation, groups=1)
        self.beta = nn.Parameter(torch.ones((1, c, 1, 1)), requires_grad=True)
        self.relu = nn.LeakyReLU(0.2, True)

    def forward(self, x: torch.Tensor):
        return self.relu(self.conv(x) * self.beta + x)


class IFBlock(nn.Module):
    def __init__(self, in_planes: int, c: int = 64):
        super().__init__()
        self.conv0 = nn.Sequential(
            conv(in_planes, c // 2, 3, 2, 1),
            conv(c // 2, c, 3, 2, 1),
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
            nn.ConvTranspose2d(c, 4 * 6, 4, 2, 1), nn.PixelShuffle(2)
        )

    def forward(
        self,
        x: torch.Tensor,
        flow: torch.Tensor | None = None,
        scale: int = 1,
    ):
        x = functional.interpolate(
            x, scale_factor=1.0 / scale, mode="bilinear", align_corners=False
        )
        if flow is not None:
            flow = (
                functional.interpolate(
                    flow,
                    scale_factor=1.0 / scale,
                    mode="bilinear",
                    align_corners=False,
                )
                * 1.0
                / scale
            )
            x = torch.cat((x, flow), 1)
        feat = self.conv0(x)
        feat = self.convblock(feat)
        tmp = self.lastconv(feat)
        tmp = functional.interpolate(
            tmp, scale_factor=scale, mode="bilinear", align_corners=False
        )
        flow = tmp[:, :4] * scale
        mask = tmp[:, 4:5]
        return flow, mask


class IFNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.block0 = IFBlock(7 + 16, c=192)
        self.block1 = IFBlock(8 + 4 + 16, c=128)
        self.block2 = IFBlock(8 + 4 + 16, c=96)
        self.block3 = IFBlock(8 + 4 + 16, c=64)
        self.encode = Head()

    def align_images(
        self,
        fclip: torch.Tensor,
        fref: torch.Tensor,
        flowmask: torch.Tensor | None,
        time: torch.Tensor,
        scales: tuple[int, ...],
        blur: int,
        smooth: int,
        ensemble: bool,
        compensate: bool,
        device: str,
        fp16: bool,
        fref_h_pad: int,
        fref_w_pad: int,
        flow2: torch.Tensor | None = None,
        fref_pref: torch.Tensor | None = None,
    ):
        def compute_flow(
            fclip_pref: torch.Tensor,
            fref_pref: torch.Tensor,
            time: torch.Tensor,
            fp16: bool,
        ):
            f0, f1 = self.encode(fclip_pref[:, :3]), self.encode(fref_pref[:, :3])
            flow, mask, block = (
                None,
                None,
                [self.block0, self.block1, self.block2, self.block3],
            )
            for i in range(4):
                inputs = torch.cat(
                    (fclip_pref[:, :3], fref_pref[:, :3], f0, f1, time), 1
                )
                if flow is None:
                    flow, mask = block[i](inputs, None, scale=scales[i])
                    if ensemble:
                        f_, m_ = block[i](
                            torch.cat(
                                (fref_pref[:, :3], fclip_pref[:, :3], f1, f0, 1 - time),
                                1,
                            ),
                            None,
                            scale=scales[i],
                        )
                        flow, mask = (
                            (flow + torch.cat((f_[:, 2:4], f_[:, :2]), 1)) / 2,
                            (mask + (-m_)) / 2,
                        )
                else:
                    if fp16:
                        wf0, wf1 = (
                            warp(f0, flow[:, :2], device).half(),
                            warp(f1, flow[:, 2:4], device).half(),
                        )
                    else:
                        wf0, wf1 = (
                            warp(f0, flow[:, :2], device),
                            warp(f1, flow[:, 2:4], device),
                        )
                    fd, m0 = block[i](
                        torch.cat(
                            (fclip_pref[:, :3], fref_pref[:, :3], wf0, wf1, time, mask),
                            1,
                        ),
                        flow,
                        scale=scales[i],
                    )
                    if ensemble:
                        f_, m_ = block[i](
                            torch.cat(
                                (
                                    fref_pref[:, :3],
                                    fclip_pref[:, :3],
                                    wf1,
                                    wf0,
                                    1 - time,
                                    -mask,
                                ),
                                1,
                            ),
                            torch.cat((flow[:, 2:4], flow[:, :2]), 1),
                            scale=scales[i],
                        )
                        fd, mask = (
                            (fd + torch.cat((f_[:, 2:4], f_[:, :2]), 1)) / 2,
                            (m0 + (-m_)) / 2,
                        )
                    else:
                        mask = m0
                    flow += fd
            return flow

        def inpaint_flow(
            flow: torch.Tensor,
            mask: torch.Tensor,
            device: str,
            max_steps: int = 100,
            feather_inpaint: int = 3,
        ):
            # step_size and feather_inpaint should be odd
            step_size = max(
                (flow.shape[2] // 100) * 2 + 1, 3
            )  # step_size = height/50 but odd and at least 3
            flow_orig = flow.clone()

            # make sure mask is binarized and the same size as flow
            mask = (mask > 0.5).float()
            if mask.shape[-2:] != flow.shape[2:]:
                mask = functional.interpolate(
                    mask,
                    size=(flow.shape[2], flow.shape[3]),
                    mode="nearest",
                    recompute_scale_factor=False,
                )
            mask_orig = mask.clone()

            # kernels for inpainting and shrinking the inpaint mask
            kernel_inpaint = torch.ones(2, 1, step_size, step_size, device=device)
            kernel_norm = torch.ones(1, 1, step_size, step_size, device=device)
            shrink_mask_kernel = torch.ones(
                1, 1, step_size - 2, step_size - 2, device=device
            )

            # kernels to grow mask and feather mask
            grow_mask_kernel = torch.ones(
                1, 1, feather_inpaint, feather_inpaint, device=device
            )
            feather_inpaint_kernel = grow_mask_kernel / (feather_inpaint**2)

            flow_down = flow
            mask_down = mask

            # use downscaling as a faster blur/averaging
            for _step in range(max_steps):
                # downscale inpaint step by 2 (each step it get 2 times smaller)
                if (
                    flow_down.shape[2] > 4 and flow_down.shape[3] > 4
                ):  # make sure it doesn't get too small
                    flow_down = functional.interpolate(
                        flow_down,
                        scale_factor=0.5,
                        mode="bilinear",
                        align_corners=False,
                    )
                    mask_down = functional.interpolate(
                        mask_down, scale_factor=0.5, mode="nearest"
                    )

                # delete flow that will be inpainted
                inv_mask = 1 - mask_down
                masked_flow = flow_down * inv_mask

                # do one inpaint step (no autocast due to occasional division artifacts)
                with torch.amp.autocast(device.type, enabled=False):
                    inpainted_flow = functional.conv2d(
                        masked_flow.to(torch.float32),
                        kernel_inpaint,
                        padding="same",
                        groups=2,
                    )
                    norm_mask = functional.conv2d(
                        inv_mask.to(torch.float32), kernel_norm, padding="same"
                    ).clamp_(min=1e-6)
                    inpainted_flow /= norm_mask

                # upscale to add inpaint step
                flow_up = functional.interpolate(
                    inpainted_flow,
                    size=(flow.shape[2], flow.shape[3]),
                    mode="bilinear",
                    align_corners=False,
                )
                mask_up = functional.interpolate(
                    mask_down, size=(flow.shape[2], flow.shape[3]), mode="nearest"
                )

                # add inpaint to flow
                inv_mask_up = 1 - mask_up
                flow.mul_(inv_mask_up).add_(flow_up * mask_up)

                # shrink mask for next step
                mask_down = (
                    1
                    - functional.conv2d(
                        1 - mask_down, shrink_mask_kernel, padding="same"
                    )
                ).clamp(0, 1)

                # check if mask is still present and if more steps are needed
                if mask_down.sum() == 0:
                    break

            # blur flow
            kernel_size = (
                flow.shape[2] // 40
            ) * 2 + 1  # blur radius = height/20 but odd
            kernel_box = torch.ones((1, 1, kernel_size), device=device) / kernel_size
            flow = functional.conv2d(
                flow,
                kernel_box.unsqueeze(2).expand(2, 1, 1, kernel_size),
                padding=(0, kernel_size // 2),
                groups=2,
            )  # horizontal blur
            flow = functional.conv2d(
                flow,
                kernel_box.unsqueeze(3).expand(2, 1, kernel_size, 1),
                padding=(kernel_size // 2, 0),
                groups=2,
            )  # vertical blur

            # feather mask
            mask_orig = functional.interpolate(
                mask_orig, scale_factor=1 / 8, mode="bilinear", align_corners=True
            )
            mask_grown = functional.conv2d(
                mask_orig, grow_mask_kernel, padding=feather_inpaint // 2
            ).clamp(0, 1)
            mask_feather = functional.conv2d(
                mask_grown, feather_inpaint_kernel, padding=feather_inpaint // 2
            ).clamp(0, 1)
            mask_feather = functional.interpolate(
                mask_feather,
                size=(flow_orig.shape[2], flow_orig.shape[3]),
                mode="bilinear",
                align_corners=True,
            )

            # make sure both tensor are the same dtype due to autocast
            flow = flow.to(mask_feather.dtype)

            # add inpaint to original flow
            return flow_orig.lerp_(flow, mask_feather)

        # check if fref_pref already available
        fref_pref_none = fref_pref is None

        # get dimensions
        fref_h, fref_w = fref.shape[2], fref.shape[3]
        fclip_h, fclip_w = fclip.shape[2], fclip.shape[3]

        # resize to fref padded
        if fclip_h != fref_h_pad or fclip_w != fref_w_pad:
            fclip_pref = functional.interpolate(
                fclip,
                size=(fref_h_pad, fref_w_pad),
                mode="bilinear",
                align_corners=False,
            )
        else:
            fclip_pref = fclip

        # resize to fref padded
        if fref_h != fref_h_pad or fref_w != fref_w_pad:
            fref = functional.interpolate(
                fref,
                size=(fref_h_pad, fref_w_pad),
                mode="bilinear",
                align_corners=False,
            )

        # pre-blur fclip and fref
        if blur is not None and blur > 0:
            gaussblur = transforms.GaussianBlur(kernel_size=(5, 5), sigma=(blur, blur))
            fclip_pref = gaussblur(fclip_pref)
            if fref_pref_none:
                fref_pref = gaussblur(fref)
        elif fref_pref_none:
            fref_pref = fref

        # compute flow from fclip_pref to fref_pref
        flow1 = compute_flow(fclip_pref, fref_pref, time, fp16)

        # compute flow from fref_pref to itself
        if compensate and flow2 is None:
            flow2 = compute_flow(fref_pref, fref_pref, time, fp16)

        # extract final flow and subtract flow2 from flow1
        if compensate:
            compensated_flow = flow1[:, :2] - flow2[:, :2]
        else:
            compensated_flow = flow1[:, :2]

        # resize flow to fclip's size
        compensated_flow = functional.interpolate(
            compensated_flow,
            size=(fref_h, fref_w),
            mode="bilinear",
            align_corners=False,
        )
        if fclip_w / fref_w_pad != 1:
            flow_x = compensated_flow[:, 0:1, :, :] * (float(fclip_w) / fref_w_pad)
            flow_y = compensated_flow[:, 1:2, :, :] * (float(fclip_h) / fref_h_pad)
            compensated_flow = torch.cat([flow_x, flow_y], dim=1)

        # inpaint flow based on mask
        if flowmask is not None:
            compensated_flow = inpaint_flow(compensated_flow, flowmask, device)

        # post-smoothing flow
        if smooth is not None and smooth > 0:
            kernel_box = torch.ones((1, 1, smooth), device=device) / smooth
            compensated_flow = functional.pad(
                compensated_flow, (smooth // 2, smooth // 2, 0, 0), mode="reflect"
            )
            compensated_flow = functional.conv2d(
                compensated_flow,
                kernel_box.unsqueeze(2).expand(2, 1, 1, smooth),
                groups=2,
            )  # horizontal blur
            compensated_flow = functional.pad(
                compensated_flow, (0, 0, smooth // 2, smooth // 2), mode="reflect"
            )
            compensated_flow = functional.conv2d(
                compensated_flow,
                kernel_box.unsqueeze(3).expand(2, 1, smooth, 1),
                groups=2,
            )  # vertical blur

        # warp fclip with compensated flow
        if fp16:
            aligned_fclip = warp(fclip, compensated_flow, device).half()
        else:
            aligned_fclip = warp(fclip, compensated_flow, device)

        # clamp and return
        return aligned_fclip.clamp_(0, 1), flow2, fref_pref

    def forward(
        self,
        fclip: torch.Tensor,  # misaligned frame.
        fref: torch.Tensor,  # reference frame.
        flowmask: torch.Tensor | None = None,  # inpainting mask for flow.
        scales: tuple[int, ...] = (8, 4, 2, 1),  # rife scale list.
        pads: tuple[int, int] = (0, 0),  # heigth and width padding.
        blur: int = 0,  # pre blurs input images.
        smooth: int = 0,  # post smoothes flow before warping.
        its: int = 1,  # runs alignment pass multiple times.
        compensate: bool = True,  # if True, fref will be aligned to itself and subtracted from flow.
        ensemble: bool = True,  # computed flow from clip to ref and ref to clip.
        device: str = "cuda",  # cpu or cuda.
        fp16: bool = False,  # if True, use half precision.
    ):
        fref_h_pad = fref.shape[2] + pads[0]
        fref_w_pad = fref.shape[3] + pads[1]
        time = torch.ones((1, 1, fref_h_pad, fref_w_pad), device=fref.device) * 1
        flow2 = None
        fref_pref = None
        for _iteration in range(its):
            aligned_fclip, flow2, fref_pref = self.align_images(
                fclip,
                fref,
                flowmask,
                time,
                scales,
                blur,
                smooth,
                ensemble,
                compensate,
                device,
                fp16,
                fref_h_pad,
                fref_w_pad,
                flow2,
                fref_pref,
            )
            fclip = (
                aligned_fclip  # use the aligned image as fclip for the next iteration
            )
        return aligned_fclip
