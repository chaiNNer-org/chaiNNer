from util import combine_sets


def test_combine_sets_one():
    test_sets = [{1, 2, 3}, {1, 4}, {5, 6}, {7, 8}]
    test_output = [{1, 2, 3, 4}, {5, 6}, {7, 8}]
    result = combine_sets(test_sets)
    assert result == test_output


def test_combine_sets_two():
    test_sets = [
        {1, 2, 3},
        {1, 4},
        {5, 6},
        {7, 8},
        {6, 7, 8, 9, 10},
        {50, 51, 52},
        {60, 61},
    ]
    test_output = [{1, 2, 3, 4}, {5, 6, 7, 8, 9, 10}, {50, 51, 52}, {60, 61}]
    result = combine_sets(test_sets)
    assert result == test_output


def test_combine_sets_three():
    test_sets = [
        {60, 90, 34},
        {1, 2, 3},
        {1, 4, 87},
        {5, 6},
        {7, 8},
        {6, 7, 8, 9, 10},
        {50, 51, 52},
        {60, 61},
    ]
    test_output = [
        {34, 60, 61, 90},
        {1, 2, 3, 4, 87},
        {5, 6, 7, 8, 9, 10},
        {50, 51, 52},
    ]
    result = combine_sets(test_sets)
    assert result == test_output


def test_combine_sets_four():
    test_sets = [
        {"a", "b", "c"},
        {"d", "e"},
        {"f", "g", "h"},
        {"h", "i", "j", "k"},
        {"x", "y", "z"},
    ]
    test_output = [
        {"a", "b", "c"},
        {"d", "e"},
        {"f", "g", "h", "i", "j", "k"},
        {"x", "y", "z"},
    ]
    result = combine_sets(test_sets)
    assert result == test_output


def test_combine_sets_five():
    test_sets = [
        {"a", "b", "c"},
        {"c", "d", "e", "f"},
        {"f", "g", "h"},
        {"h", "i", "j", "k"},
        {"x", "y", "z"},
        {"k", "lmnopqrstuvw", "x", "y"},
    ]
    test_output = [
        {
            "a",
            "b",
            "c",
            "d",
            "e",
            "f",
            "g",
            "h",
            "i",
            "j",
            "k",
            "lmnopqrstuvw",
            "x",
            "y",
            "z",
        },
    ]
    result = combine_sets(test_sets)
    assert result == test_output
