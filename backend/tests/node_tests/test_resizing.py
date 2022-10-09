from ...src.nodes.nodes.image.load_image import ImReadNode
from ...src.nodes.nodes.image_dimension import resize_factor, resize_resolution


def test_resize_factor():
    imread_node = ImReadNode()
    resize_factor_node = resize_factor.ImResizeByFactorNode()

    # Test RGBA
    img_1024_RGBA, _, _ = imread_node.run("backend/tests/test_images/1024x1024x4.png")
    assert resize_factor_node.run(img_1024_RGBA, 0.5 * 100, -1).shape == (512, 512, 4)
    assert resize_factor_node.run(img_1024_RGBA, 0.25 * 100, -1).shape == (256, 256, 4)
    assert resize_factor_node.run(img_1024_RGBA, 0.125 * 100, -1).shape == (128, 128, 4)
    assert resize_factor_node.run(img_1024_RGBA, 0.0625 * 100, -1).shape == (64, 64, 4)
    assert resize_factor_node.run(img_1024_RGBA, 2 * 100, -1).shape == (2048, 2048, 4)

    # Test RGB
    img_1024_RGB = img_1024_RGBA[:, :, :3]
    assert resize_factor_node.run(img_1024_RGB, 0.5 * 100, -1).shape == (512, 512, 3)
    assert resize_factor_node.run(img_1024_RGB, 0.25 * 100, -1).shape == (256, 256, 3)
    assert resize_factor_node.run(img_1024_RGB, 0.125 * 100, -1).shape == (128, 128, 3)
    assert resize_factor_node.run(img_1024_RGB, 0.0625 * 100, -1).shape == (64, 64, 3)
    assert resize_factor_node.run(img_1024_RGB, 2 * 100, -1).shape == (2048, 2048, 3)

    # Test Grayscale
    img_1024_Gray = img_1024_RGBA[:, :, 0]
    assert resize_factor_node.run(img_1024_Gray, 0.5 * 100, -1).shape == (512, 512)
    assert resize_factor_node.run(img_1024_Gray, 0.25 * 100, -1).shape == (256, 256)
    assert resize_factor_node.run(img_1024_Gray, 0.125 * 100, -1).shape == (128, 128)
    assert resize_factor_node.run(img_1024_Gray, 0.0625 * 100, -1).shape == (64, 64)
    assert resize_factor_node.run(img_1024_Gray, 2 * 100, -1).shape == (2048, 2048)


def test_resize_resolution():
    imread_node = ImReadNode()
    resize_resolution_node = resize_resolution.ImResizeToResolutionNode()

    # Test RGBA
    img_1024_RGBA, _, _ = imread_node.run("backend/tests/test_images/1024x1024x4.png")
    assert resize_resolution_node.run(img_1024_RGBA, 512, 512, -1).shape == (
        512,
        512,
        4,
    )
    assert resize_resolution_node.run(img_1024_RGBA, 256, 256, -1).shape == (
        256,
        256,
        4,
    )
    assert resize_resolution_node.run(img_1024_RGBA, 128, 128, -1).shape == (
        128,
        128,
        4,
    )
    assert resize_resolution_node.run(img_1024_RGBA, 64, 64, -1).shape == (64, 64, 4)
    assert resize_resolution_node.run(img_1024_RGBA, 2048, 2048, -1).shape == (
        2048,
        2048,
        4,
    )

    # Test RGB
    img_1024_RGB = img_1024_RGBA[:, :, :3]
    assert resize_resolution_node.run(img_1024_RGB, 512, 512, -1).shape == (512, 512, 3)
    assert resize_resolution_node.run(img_1024_RGB, 256, 256, -1).shape == (256, 256, 3)
    assert resize_resolution_node.run(img_1024_RGB, 128, 128, -1).shape == (128, 128, 3)
    assert resize_resolution_node.run(img_1024_RGB, 64, 64, -1).shape == (64, 64, 3)
    assert resize_resolution_node.run(img_1024_RGB, 2048, 2048, -1).shape == (
        2048,
        2048,
        3,
    )

    # Test Grayscale
    img_1024_Gray = img_1024_RGBA[:, :, 0]
    assert resize_resolution_node.run(img_1024_Gray, 512, 512, -1).shape == (512, 512)
    assert resize_resolution_node.run(img_1024_Gray, 256, 256, -1).shape == (256, 256)
    assert resize_resolution_node.run(img_1024_Gray, 128, 128, -1).shape == (128, 128)
    assert resize_resolution_node.run(img_1024_Gray, 64, 64, -1).shape == (64, 64)
    assert resize_resolution_node.run(img_1024_Gray, 2048, 2048, -1).shape == (
        2048,
        2048,
    )
