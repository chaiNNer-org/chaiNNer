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
from .pytorch_nodes import to_pytorch_execution_options


@NodeFactory.register("chainner:pytorch:upscale_face")
@torch.inference_mode()
class FaceUpscaleNode(NodeBase):
    def __init__(self):
        super().__init__()
        self.description = "Uses face-detection to upscales and restore face(s) in an image using a PyTorch Face Super-Resolution model. Right now supports GFPGAN and RestoreFormer."
        self.inputs = [
            ModelInput(
                "Face SR Model",
                input_type="PyTorchModel { arch: PyTorchModel::FaceArchs }",
            ),
            ImageInput(),
            ImageInput("Upscaled Background").make_optional(),
            NumberInput(
                label="Output Scale", default=8, minimum=1, maximum=8, unit="x"
            ),
        ]
        self.outputs = [
            ImageOutput(
                "Upscaled Image",
                image_type="""
                Image {
                    width: Input3 * Input1.width,
                    height: Input3 * Input1.height,
                    channels: 3
                }
                """,
            )
        ]

        self.category = PyTorchCategory
        self.name = "Upscale Face"
        self.icon = "PyTorch"
        self.sub = "Restoration"

    def denormalize(self, img: np.ndarray):
        img = (img * 255).astype(np.uint8)
        _, _, c = get_h_w_c(img)
        if c == 4:
            img = img[:, :, :3]
        elif c == 1:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        return img

    def upscale(
        self,
        img: np.ndarray,
        background_img: Union[np.ndarray, None],
        face_helper: FaceRestoreHelper,
        face_model: PyTorchModel,
        weight: float,
    ):
        exec_options = to_pytorch_execution_options(get_execution_options())
        device = torch.device(exec_options.device)
        face_helper.clean_all()

        face_helper.read_image(img)
        # get face landmarks for each face
        face_helper.get_face_landmarks_5(only_center_face=False, eye_dist_threshold=5)
        # eye_dist_threshold=5: skip faces whose eye distance is smaller than 5 pixels
        # TODO: even with eye_dist_threshold, it will still introduce wrong detections and restorations.
        # align and warp each face
        face_helper.align_warp_face()

        should_use_fp16 = exec_options.fp16 and face_model.supports_fp16
        if should_use_fp16:
            face_model.half()
        else:
            face_model.float()

        # face restoration
        for cropped_face in face_helper.cropped_faces:
            # prepare data
            cropped_face_t = np2tensor(
                cropped_face, bgr2rgb=True, change_range=True, add_batch=False
            )
            tv_normalize(cropped_face_t, (0.5, 0.5, 0.5), (0.5, 0.5, 0.5), inplace=True)  # type: ignore
            cropped_face_t = cropped_face_t.unsqueeze(0).to(device)  # type: ignore

            try:
                if should_use_fp16:
                    cropped_face_t.half()
                else:
                    cropped_face_t.float()
                output = face_model(cropped_face_t, return_rgb=False, weight=weight)[0]
                # convert to image
                output = (output + 1) / 2
                restored_face = tensor2np(output.squeeze(0), rgb2bgr=True)
            except RuntimeError as error:
                logger.error(f"\tFailed inference for GFPGAN: {error}.")
                restored_face = cropped_face

            restored_face = restored_face.astype("uint8")  # type: ignore
            face_helper.add_restored_face(restored_face)

        if background_img is not None:
            # upsample the background
            background_img = self.denormalize(background_img)

            face_helper.get_inverse_affine(None)
            # paste each restored face to the input image
            restored_img = face_helper.paste_faces_to_input_image(
                upsample_img=background_img
            )
        else:
            face_helper.get_inverse_affine(None)
            restored_img = face_helper.paste_faces_to_input_image()
        del face_helper
        torch.cuda.empty_cache()

        return restored_img

    def run(
        self,
        face_model: PyTorchModel,
        img: np.ndarray,
        background_img: Union[np.ndarray, None],
        upscale: int,
    ) -> np.ndarray:
        """Upscales an image with a pretrained model"""
        face_helper = None
        try:
            img = self.denormalize(img)

            exec_options = to_pytorch_execution_options(get_execution_options())
            device = torch.device(exec_options.device)

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

                result = self.upscale(
                    img,
                    background_img,
                    face_helper,
                    face_model,
                    weight,
                )

                return result

        except Exception as e:
            logger.error(f"GFPGAN failed: {e}")
            face_helper = None
            del face_helper
            torch.cuda.empty_cache()
            # pylint: disable=raise-missing-from
            raise RuntimeError("Failed to run GFPGAN.")
