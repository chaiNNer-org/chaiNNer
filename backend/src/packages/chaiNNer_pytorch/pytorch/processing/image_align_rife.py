
# Original Rife Frame Interpolation by hzwer
# https://github.com/megvii-research/ECCV2022-RIFE
# https://github.com/hzwer/Practical-RIFE

# Modifications to use Rife for Image Alignment by tepete ('Enhance Everything!' Discord Server)

# Additional helpful github issues
# https://github.com/megvii-research/ECCV2022-RIFE/issues/278
# https://github.com/megvii-research/ECCV2022-RIFE/issues/344

import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.append(project_root)

import torch
import torch.nn.functional as F
import numpy as np
import cv2
from api import NodeContext
from nodes.properties.inputs import ImageInput, EnumInput, NumberInput, BoolInput, SliderInput
from nodes.properties.outputs import ImageOutput
from ...settings import PyTorchSettings, get_settings
from .. import processing_group
from nodes.impl.pytorch.utils import np2tensor, tensor2np
from nodes.impl.resize import resize, ResizeFilter
from nodes.utils.utils import get_h_w_c
from packages.chaiNNer_pytorch.pytorch.processing.rife.IFNet_HDv3_v4_14_align import IFNet
from enum import Enum

class PrecisionMode(Enum):
    FIFTY_PERCENT         = 2000
    ONE_HUNDRED_PERCENT   = 1000
    TWO_HUNDRED_PERCENT   = 500
    FOUR_HUNDRED_PERCENT  = 250
    EIGHT_HUNDRED_PERCENT = 125

def calculate_padding(height, width, precision_mode):
    if precision_mode == PrecisionMode.EIGHT_HUNDRED_PERCENT:
        pad_value = 4
    elif precision_mode == PrecisionMode.FOUR_HUNDRED_PERCENT:
        pad_value = 8
    elif precision_mode == PrecisionMode.TWO_HUNDRED_PERCENT:
        pad_value = 16
    elif precision_mode == PrecisionMode.ONE_HUNDRED_PERCENT:
        pad_value = 32
    else:
        pad_value = 64
    
    pad_height = (pad_value - height % pad_value) % pad_value
    pad_width = (pad_value - width % pad_value) % pad_value
    return pad_height, pad_width

def align_images(context, target_img: np.ndarray, source_img: np.ndarray, precision_mode, model_path=os.path.join('processing', 'rife'), model_file='flownet_v4.14.pkl', multiplier=1, alignment_passes=1, blur_strength=0, ensemble=True) -> np.ndarray:
    source_h, source_w, _ = get_h_w_c(source_img)
    target_h, target_w, _ = get_h_w_c(target_img)

    #resize, then shift reference left because rife shifts slightly to the right)
    target_img_resized = resize(target_img, (source_w, source_h), filter=ResizeFilter.LANCZOS)
    target_img_resized = np.roll(target_img_resized, -1, axis=1)
    target_img_resized[:, -1] = target_img_resized[:, -2]

    #resize, then shift reference left because rife shifts slightly to the right)
    #different approach to do subpixel shift
    #scale_x = source_w / target_w
    #scale_y = source_h / target_h
    #shift_x = -1.0
    #shift_y = 0
    #transformation_matrix = np.float32([[scale_x, 0, shift_x], [0, scale_y, shift_y]])
    #target_img_resized = cv2.warpAffine(target_img, transformation_matrix, (source_w, source_h), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
    
    #padding because rife can only work with multiples of 32 (changes with precision mode)
    pad_h, pad_w = calculate_padding(source_h, source_w, precision_mode)
    top_pad = pad_h // 2
    bottom_pad = pad_h - top_pad
    left_pad = pad_w // 2
    right_pad = pad_w - left_pad
    target_img_padded = np.pad(target_img_resized, ((top_pad, bottom_pad), (left_pad, right_pad), (0, 0)), mode='edge')
    source_img_padded = np.pad(source_img, ((top_pad, bottom_pad), (left_pad, right_pad), (0, 0)), mode='edge')
    #target_img_padded = target_img
    #source_img_padded = source_img_resized

    exec_options = get_settings(context)
    device = exec_options.device

    #load model
    model_full_path = os.path.join(project_root, model_path, model_file)
    model = IFNet().to(device)#.half()
    state_dict = torch.load(model_full_path, map_location=device)
    new_state_dict = {k.replace('module.', ''): v for k, v in state_dict.items()}
    model.load_state_dict(new_state_dict)
    model.eval()

    #convert to tensors
    target_tensor_padded = np2tensor(target_img_padded, change_range=True).to(device)#.half()
    source_tensor_padded = np2tensor(source_img_padded, change_range=True).to(device)#.half()

    #concatenate images
    img_pair = torch.cat((target_tensor_padded, source_tensor_padded), dim=1)

    with torch.no_grad():
        aligned_img, _ = model(img_pair, multiplier=multiplier, num_iterations=alignment_passes, blur_strength=blur_strength, ensemble=ensemble, device=device)

    #convert back to numpy and crop
    result_img = tensor2np(aligned_img.squeeze(0).cpu(), change_range=False, imtype=np.float32)
    result_img = result_img[top_pad:top_pad+source_h, left_pad:left_pad+source_w]

    return result_img








@processing_group.register(
    schema_id="chainner:pytorch:image_align_rife",
    name="Image Align with Rife",
    description="Aligns an Image with a Reference Image using Rife. Images should have vague alignment before using this Node. Output Image will have the same dimensions as Reference Image. Resize Reference Image to get desired output scale.",
    icon="BsRulers",
    inputs=[
        ImageInput(label="Image", channels=3),
        ImageInput(label="Reference Image", channels=3),
        EnumInput(
            PrecisionMode,
            label="Precision",
            default=PrecisionMode.ONE_HUNDRED_PERCENT,
            option_labels={
                PrecisionMode.FIFTY_PERCENT: "50%",
                PrecisionMode.ONE_HUNDRED_PERCENT: "100%",
                PrecisionMode.TWO_HUNDRED_PERCENT: "200%",
                PrecisionMode.FOUR_HUNDRED_PERCENT: "400%",
                PrecisionMode.EIGHT_HUNDRED_PERCENT: "800% (VRAM!)",
            },
        )
        .with_docs(
            "If the Alignment is very close, try a **high** value.",
            "If the Alignment is **not** very close, try a **low** value.",
            "Higher values will internally align at higher resolutions to increase precision, which will in turn increase processing time and VRAM usage. Lower values are less precise, but can align over larger distances.",
            hint=True,
        ),
        NumberInput(
            "Alignment Passes",
            controls_step=1,
            maximum=1000,
            default=1,
            unit="#",
        )
        .with_docs(
            "Runs the alignment multiple times.",
            "With more than around 4 passes, artifacts can appear. Try to keep it low.",
            hint=True,
        ),
        NumberInput(
            "Blur Strength",
            minimum=0,
            maximum=100,
            default=0,
            precision=1,
            controls_step=1,
            unit="⌀"
        )
        .with_docs(
            "Blur is only used internally and will not be visible on the Output Image. It will reduce accuracy, try to keep it **low**. The **best** alignment will be at **Blur 0**.",
            "Blur can help to ignore strong degredations (like compression or noise). If the lines on the Output Image get thinner or thicker, try to increase the blur a little as well.",
            hint=True,
        ),
    ],
    outputs=[
        ImageOutput().with_never_reason("Returns the aligned image.")
    ],
    node_context=True,
)
def image_aligner_node(context, target_img: np.ndarray, source_img: np.ndarray, precision: PrecisionMode, alignment_passes: int, blur_strength: float) -> np.ndarray:
    multiplier = precision.value / 1000
    return align_images(context, target_img, source_img, precision, multiplier=multiplier, alignment_passes=alignment_passes, blur_strength=blur_strength, ensemble=1)