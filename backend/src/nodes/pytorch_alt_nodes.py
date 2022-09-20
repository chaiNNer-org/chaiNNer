"""
Mainly to separate GFPGAN from the rest of the nodes
"""

from __future__ import annotations

import numpy as np
import torch
from sanic.log import logger

from torchvision.transforms.functional import normalize as tv_normalize
from facexlib.utils.face_restoration_helper import FaceRestoreHelper

from appdirs import user_data_dir

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
            ModelInput(
                "Face SR Model",
                input_type='PyTorchModel { modelType: "GFPGAN" | "RestoreFormer" }',
            ),
            ModelInput(
                "Background SR Model",
                input_type='PyTorchModel { modelType: "ESRGAN" | "ESRGAN+" | "SPSR" | "SRVGG (RealESRGAN)" | "Swift-SRGAN" | "SwinIR" }',
            ).make_optional(),
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
        face_model: PyTorchModel,
        background_model: Union[PyTorchModel, None],
        img: np.ndarray,
        tile_mode: int,
    ) -> np.ndarray:
        """Upscales an image with a pretrained model"""
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

            upscale = face_model.scale
            weight = 0.5

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
                        output = face_model(
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
                    background_upscale = (
                        ImageUpscaleNode().run(background_model, img, tile_mode) * 255
                    ).astype(np.uint8)

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
                    face_helper.get_inverse_affine(None)
                    restored_img = face_helper.paste_faces_to_input_image()
                del face_helper
                torch.cuda.empty_cache()

                return restored_img
        except Exception as e:
            logger.error(f"GFPGAN failed: {e}")
            face_helper = None, None
            del face_helper
            torch.cuda.empty_cache()
            # pylint: disable=raise-missing-from
            raise RuntimeError("Failed to run GFPGAN.")
