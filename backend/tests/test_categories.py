from ..src.nodes.category import Category


def test_categories():
    test_category = Category(
        name="Test",
        description="Test category.",
        icon="BsGearFill",
        color="#718096",
    )
    assert test_category.name == "Test"
    assert test_category.description == "Test category."
    assert test_category.icon == "BsGearFill"
    assert test_category.color == "#718096"
