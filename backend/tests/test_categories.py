from ..src.nodes.categories import category_order


def test_categories():
    assert isinstance(category_order, list)
    assert len(category_order) == 9
