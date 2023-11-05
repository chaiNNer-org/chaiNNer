from __future__ import annotations

import gc

import numpy as np

try:
    from ncnn_vulkan import ncnn

    use_gpu = True
except ImportError:
    from ncnn import ncnn

    use_gpu = False
from sanic.log import logger

from ...utils.utils import get_h_w_c
from ..image_utils import to_uint8
from ..upscale.auto_split import Split, Tiler, auto_split


def ncnn_auto_split(
    img: np.ndarray,
    net,  # noqa: ANN001
    input_name: str,
    output_name: str,
    blob_vkallocator,  # noqa: ANN001
    staging_vkallocator,  # noqa: ANN001
    tiler: Tiler,
) -> np.ndarray:
    def upscale(img: np.ndarray, _: object):
        ex = net.create_extractor()
        if use_gpu:
            ex.set_blob_vkallocator(blob_vkallocator)
            ex.set_workspace_vkallocator(blob_vkallocator)
            ex.set_staging_vkallocator(staging_vkallocator)
        # ex.set_light_mode(True)
        try:
            lr_c = get_h_w_c(img)[2]
            lr_img_fix = to_uint8(img)
            if lr_c == 1:
                pixel_type = ncnn.Mat.PixelType.PIXEL_GRAY
            elif lr_c == 3:
                pixel_type = ncnn.Mat.PixelType.PIXEL_RGB
            else:
                pixel_type = ncnn.Mat.PixelType.PIXEL_RGBA
            mat_in = ncnn.Mat.from_pixels(
                lr_img_fix,
                pixel_type,
                lr_img_fix.shape[1],
                lr_img_fix.shape[0],
            )
            mean_vals = []
            norm_vals = [1 / 255.0] * lr_c
            mat_in.substract_mean_normalize(mean_vals, norm_vals)
            ex.input(input_name, mat_in)
            _, mat_out = ex.extract(output_name)
            result = np.array(mat_out).transpose(1, 2, 0).astype(np.float32)
            del ex, mat_in, mat_out
            gc.collect()
            if use_gpu:
                # Clear VRAM
                blob_vkallocator.clear()
                staging_vkallocator.clear()
            return result
        except Exception as e:
            if "vkQueueSubmit" in str(e):
                ex = None
                del ex
                gc.collect()
                if use_gpu:
                    blob_vkallocator.clear()
                    staging_vkallocator.clear()
                # TODO: Have someone running into this issue enable this and see if it fixes anything
                # ncnn.destroy_gpu_instance()
                raise RuntimeError(
                    "A critical error has occurred. You may need to restart chaiNNer in order for NCNN upscaling to start working again."
                ) from e
            # Check to see if its actually the NCNN out of memory error
            if "failed" in str(e):
                # clear VRAM
                logger.debug("NCNN out of VRAM, clearing VRAM and splitting.")
                ex = None
                del ex
                gc.collect()
                if use_gpu:
                    blob_vkallocator.clear()
                    staging_vkallocator.clear()
                return Split()
            else:
                # Re-raise the exception if not an OOM error
                raise

    return auto_split(img, upscale, tiler)
