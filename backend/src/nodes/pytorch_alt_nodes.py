"""
Mainly to separate GFPGAN from the rest of the nodes
"""

from __future__ import annotations

import numpy as np
import torch
from sanic.log import logger

from torchvision.transforms.functional import normalize as tv_normalize
from basicsr.utils.download_util import load_file_from_url
from facexlib.utils.face_restoration_helper import FaceRestoreHelper

from appdirs import user_data_dir

from .utils.architecture.GFPGAN.gfpgan_bilinear_arch import GFPGANBilinear
from .utils.architecture.GFPGAN.gfpganv1_clean_arch import GFPGANv1Clean
from .utils.architecture.GFPGAN.restoreformer_arch import RestoreFormer

from .categories import PyTorchCategory
from .node_base import NodeBase
from .node_factory import NodeFactory
from .properties.inputs import *
from .properties.outputs import *
from .utils.utils import get_h_w_c, np2tensor, tensor2np
from .utils.exec_options import get_execution_options
from .utils.torch_types import PyTorchModel
from .pytorch_nodes import ImageUpscaleNode, to_pytorch_execution_options


@NodeFactory.register("chainner:pytorch:upscale_face")
@torch.inference_mode()
class FaceUpscaleNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Upscales & Restores a face in an image using a PyTorch Face Super-Resolution model. Right now supports GFPGAN and RestoreFormer."
        self.inputs = [
            FaceUpscaleDropdown(),
            ModelInput("Background SR Model").make_optional(),
            ImageInput(),
            TileModeDropdown(label="Background SR Tile Mode"),
        ]
        self.outputs = [
            ImageOutput(
                "Upscaled Image",
                image_type="""
                Image {
                    width: multiply(2, Input2.width),
                    height: multiply(2, Input2.height),
                    channels: 3
                }
                """,
            )
        ]

        self.category = PyTorchCategory
        self.name = "Upscale Face"
        self.icon = "PyTorch"
        self.sub = "Restoration"

    def run(
        self,
        face_model: str,
        background_model: Union[PyTorchModel, None],
        img: np.ndarray,
        tile_mode: int,
    ) -> np.ndarray:
        """Upscales an image with a pretrained model"""
        gfpgan = None
        face_helper = None
        try:
            img = (img * 255).astype(np.uint8)
            h, w, c = get_h_w_c(img)
            if c == 4:
                img = img[:, :, :3]
            elif c == 1:
                img = np.repeat(img, 3, axis=2)

            exec_options = to_pytorch_execution_options(get_execution_options())
            device = torch.device(exec_options.device)

            upscale = 2
            weight = 0.5

            if face_model == "GFPGANv1":
                raise NotImplementedError("GFPGANv1 is not supported.")
                # arch = "original"
                # channel_multiplier = 1
                # model_name = "GFPGANv1"
                # url = "https://github.com/TencentARC/GFPGAN/releases/download/v0.1.0/GFPGANv1.pth"
            elif face_model == "GFPGANv1.2":
                arch = "clean"
                channel_multiplier = 2
                model_name = "GFPGANCleanv1-NoCE-C2"
                url = "https://github.com/TencentARC/GFPGAN/releases/download/v0.2.0/GFPGANCleanv1-NoCE-C2.pth"
            elif face_model == "GFPGANv1.3":
                arch = "clean"
                channel_multiplier = 2
                model_name = "GFPGANv1.3"
                url = "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.3.pth"
            elif face_model == "GFPGANv1.4":
                arch = "clean"
                channel_multiplier = 2
                model_name = "GFPGANv1.4"
                url = "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth"
            elif face_model == "RestoreFormer":
                arch = "RestoreFormer"
                channel_multiplier = 2
                model_name = "RestoreFormer"
                url = "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/RestoreFormer.pth"
            else:
                raise ValueError(f"Unknown model {face_model}.")

            if arch == "clean":
                gfpgan = GFPGANv1Clean(
                    out_size=512,
                    num_style_feat=512,
                    channel_multiplier=channel_multiplier,
                    decoder_load_path=None,
                    fix_decoder=False,
                    num_mlp=8,
                    input_is_latent=True,
                    different_w=True,
                    narrow=1,
                    sft_half=True,
                )
            elif arch == "bilinear":
                gfpgan = GFPGANBilinear(
                    out_size=512,
                    num_style_feat=512,
                    channel_multiplier=channel_multiplier,
                    decoder_load_path=None,
                    fix_decoder=False,
                    num_mlp=8,
                    input_is_latent=True,
                    different_w=True,
                    narrow=1,
                    sft_half=True,
                )
            elif arch == "original":
                raise NotImplementedError("GFPGANv1 is not supported.")
                # gfpgan = GFPGANv1(
                #     out_size=512,
                #     num_style_feat=512,
                #     channel_multiplier=channel_multiplier,
                #     decoder_load_path=None,
                #     fix_decoder=True,
                #     num_mlp=8,
                #     input_is_latent=True,
                #     different_w=True,
                #     narrow=1,
                #     sft_half=True,
                # )
            elif arch == "RestoreFormer":
                gfpgan = RestoreFormer()
            else:
                raise ValueError(f"Unknown arch {arch}.")

            with torch.no_grad():
                appdata_path = user_data_dir(roaming=True)
                path_str = "chaiNNer/python/gfpgan/weights"
                download_path = os.path.join(appdata_path, path_str)

                # initialize face helper
                face_helper = FaceRestoreHelper(
                    upscale,
                    face_size=512,
                    crop_ratio=(1, 1),
                    det_model="retinaface_resnet50",
                    save_ext="png",
                    use_parse=True,
                    device=device,
                    model_rootpath=download_path,
                )

                # For now, rely solely on url
                model_path = url
                if model_path.startswith("https://"):
                    model_path = load_file_from_url(
                        url=model_path,
                        model_dir=download_path,
                        progress=True,
                        file_name=None,
                    )
                loadnet = torch.load(model_path)
                if "params_ema" in loadnet:
                    keyname = "params_ema"
                else:
                    keyname = "params"
                gfpgan.load_state_dict(loadnet[keyname], strict=True)
                gfpgan.eval()
                gfpgan = gfpgan.to(device)

                face_helper.clean_all()

                face_helper.read_image(img)
                # get face landmarks for each face
                face_helper.get_face_landmarks_5(
                    only_center_face=False, eye_dist_threshold=5
                )
                # eye_dist_threshold=5: skip faces whose eye distance is smaller than 5 pixels
                # TODO: even with eye_dist_threshold, it will still introduce wrong detections and restorations.
                # align and warp each face
                face_helper.align_warp_face()

                # face restoration
                for cropped_face in face_helper.cropped_faces:
                    # prepare data
                    cropped_face_t = np2tensor(
                        cropped_face, bgr2rgb=True, change_range=True, add_batch=False
                    )
                    tv_normalize(cropped_face_t, (0.5, 0.5, 0.5), (0.5, 0.5, 0.5), inplace=True)  # type: ignore
                    cropped_face_t = cropped_face_t.unsqueeze(0).to(device)  # type: ignore

                    try:
                        output = gfpgan(
                            cropped_face_t, return_rgb=False, weight=weight
                        )[0]
                        # convert to image
                        output = (output + 1) / 2
                        restored_face = tensor2np(output.squeeze(0), rgb2bgr=True)
                    except RuntimeError as error:
                        print(f"\tFailed inference for GFPGAN: {error}.")
                        restored_face = cropped_face

                    restored_face = restored_face.astype("uint8")  # type: ignore
                    face_helper.add_restored_face(restored_face)

                h, w, _ = get_h_w_c(img)
                upsample_h = int(h * upscale)
                upsample_w = int(w * upscale)

                if background_model is not None:
                    # upsample the background
                    background_upscale = ImageUpscaleNode().run(
                        background_model, img, tile_mode
                    )

                    face_helper.get_inverse_affine(None)
                    # paste each restored face to the input image
                    restored_img = face_helper.paste_faces_to_input_image(
                        upsample_img=cv2.resize(
                            background_upscale,
                            (upsample_h, upsample_w),
                            interpolation=cv2.INTER_AREA,
                        ),
                    )
                else:
                    restored_img = face_helper.paste_faces_to_input_image(
                        upsample_img=cv2.resize(
                            img, (upsample_h, upsample_w), interpolation=cv2.INTER_AREA
                        ),
                    )
                del gfpgan, face_helper
                torch.cuda.empty_cache()

                return restored_img
        except Exception as e:
            logger.error(f"GFPGAN failed: {e}")
            gfpgan, face_helper = None, None
            del gfpgan, face_helper
            torch.cuda.empty_cache()
            # pylint: disable=raise-missing-from
            raise RuntimeError("Failed to run GFPGAN.")
