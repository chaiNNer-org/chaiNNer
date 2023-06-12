# Data representation

ChaiNNer has to deal with multiples types of data (images, text, numbers, etc.). To make data handling easier, ChaiNNer enforces that all node implementations follow certain conventions. These conventions are guaranteed by inputs and enforced by outputs.

## Numbers

Depending on the precision of the inputs, chaiNNer will either use `float` (precision > 0) or `int` (precision = 0) to represent numbers.

This is guaranteed by all numeric inputs. Numeric outputs do not enforce any such thing and will accept both `float` and `int`.

## Text

Text is represented as `str`. If a number is connected to a text input, it will be converted to `str`.

## Images

Images are represented using numpy `ndarray` and are guaranteed to have the following:

- They are `float32` arrays.
- All values are finite (no NaN, inf, -inf) and range between 0 and 1 (inclusive).
- The shape of the array is either `(height, width, channels)` (with `channels > 1`) or `(height, width)`. Grayscale/single-channel images are represented as 2D arrays.
- Channels are in BGR and BGRA order.
- The array is readonly. Writing to it will cause a runtime error.

Note: You may **not** assume that chaiNNer only supports images with 1, 3, or 4 channels. It is possible that chaiNNer will support images with more channels in the future. If your node relies on this assumption, you should use `ImageInput`'s `channels` argument to enforce it. Simply add `channels=[1, 3, 4]`.

`ImageOutput` will try to convert the output image to fit the above conventions. It will:

1. Convert the image to `float32` if it isn't already. Integer formats (e.g. `uint8`) will automatically be brought into 0 to 1 range.
2. Clip values between 0 and 1 (inclusive).
3. Convert single-channel 3D images to 2D.

Since channel order cannot be checked, you have to guarantee this yourself.

## Colors

Colors are represented using chaiNNer's `Color` class.

The `Color` class is a wrapper around a tuple of floats that represent the channels of the color. Just like with images, the channels are in BGR and BGRA order. You can generally think of `Color` as a 1x1 image.

## Models

ChaiNNer has types for models of each platform (PyTorch, NCNN, ONNX). Models will be represented using platform-specific classes. See their input and output classes for more information.
