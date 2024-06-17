from __future__ import annotations

from typing import TypeVar

from util import combine_sets

T = TypeVar("T")


def freeze(list_of_sets: list[set[T]]) -> set[frozenset[T]]:
    """Freezes every set in a list of sets and returns a set of frozen sets"""
    return {frozenset(x) for x in list_of_sets}


S = TypeVar("S")


def ls_equal(a: list[set[S]], b: list[set[S]]) -> bool:
    """
    Checks if two lists of sets are equal to each other.
    Converts to two sets of frozen sets so that order doesn't matter.
    Also verifies length just in case duplicates exist (which they shouldn't)
    """
    len_equal = len(a) == len(b)
    frozen_equal = freeze(a) == freeze(b)
    return len_equal and frozen_equal


def test_combine_sets_one():
    test_sets = [{1, 2, 3}, {1, 4}, {5, 6}, {7, 8}]
    test_output = [{1, 2, 3, 4}, {5, 6}, {7, 8}]
    result = combine_sets(test_sets)
    assert ls_equal(result, test_output)


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
    assert ls_equal(result, test_output)


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
        {1, 2, 3, 4, 87},
        {5, 6, 7, 8, 9, 10},
        {50, 51, 52},
        {34, 60, 61, 90},
    ]
    result = combine_sets(test_sets)
    assert ls_equal(result, test_output)


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
    assert ls_equal(result, test_output)


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
    assert ls_equal(result, test_output)


def test_combine_sets_identity_one():
    test_sets = [{"a", "b", "c"}, {"d", "e", "f"}, {"g", "h", "i"}]
    test_output = [{"a", "b", "c"}, {"d", "e", "f"}, {"g", "h", "i"}]
    result = combine_sets(test_sets)
    assert ls_equal(result, test_output)


def test_combine_sets_identity_two():
    test_sets = [{"a", "b", "c", "d", "e", "f"}]
    test_output = [{"a", "b", "c", "d", "e", "f"}]
    result = combine_sets(test_sets)
    assert ls_equal(result, test_output)


def test_combine_sets_identity_three():
    test_sets = [{"a"}, {"b"}, {"c"}, {"d"}, {"e"}, {"f"}]
    test_output = [{"a"}, {"b"}, {"c"}, {"d"}, {"e"}, {"f"}]
    result = combine_sets(test_sets)
    assert ls_equal(result, test_output)
