"""Tests for navi module type expression helpers."""

from __future__ import annotations

import math

from navi import (
    Color,
    Image,
    field,
    fn,
    from_number_json,
    int_interval,
    intersect,
    intersect_with_error,
    interval,
    literal,
    match,
    named,
    to_number_json,
    union,
)


def test_to_number_json_regular_numbers():
    """Test conversion of regular numbers to JSON."""
    assert to_number_json(42) == 42
    assert to_number_json(3.14) == 3.14
    assert to_number_json(0) == 0
    assert to_number_json(-10) == -10


def test_to_number_json_special_values():
    """Test conversion of special float values to JSON strings."""
    assert to_number_json(float("inf")) == "inf"
    assert to_number_json(float("-inf")) == "-inf"
    assert to_number_json(float("nan")) == "NaN"


def test_from_number_json_regular_numbers():
    """Test conversion from JSON to regular numbers."""
    assert from_number_json(42) == 42
    assert from_number_json(3.14) == 3.14
    assert from_number_json(0) == 0
    assert from_number_json(-10) == -10


def test_from_number_json_special_values():
    """Test conversion from JSON strings to special float values."""
    assert from_number_json("inf") == float("inf")
    assert from_number_json("-inf") == float("-inf")
    assert math.isnan(from_number_json("NaN"))


def test_to_from_number_json_roundtrip():
    """Test that to_number_json and from_number_json are inverses."""
    test_values = [0, 1, -1, 3.14, float("inf"), float("-inf"), float("nan")]
    for value in test_values:
        json_value = to_number_json(value)
        restored = from_number_json(json_value)
        if math.isnan(value):
            assert math.isnan(restored)
        else:
            assert restored == value


def test_literal_string():
    """Test literal creation with string."""
    result = literal("test")
    assert result == {"type": "string-literal", "value": "test"}


def test_literal_number():
    """Test literal creation with number."""
    result = literal(42)
    assert result == {"type": "numeric-literal", "value": 42}


def test_literal_float():
    """Test literal creation with float."""
    result = literal(3.14)
    assert result == {"type": "numeric-literal", "value": 3.14}


def test_interval_full():
    """Test interval with min and max."""
    result = interval(0, 100)
    assert result == {"type": "interval", "min": 0, "max": 100}


def test_interval_unbounded():
    """Test interval without bounds."""
    result = interval()
    assert result == {"type": "interval", "min": "-inf", "max": "inf"}


def test_interval_min_only():
    """Test interval with only minimum."""
    result = interval(min_value=10)
    assert result == {"type": "interval", "min": 10, "max": "inf"}


def test_interval_max_only():
    """Test interval with only maximum."""
    result = interval(max_value=100)
    assert result == {"type": "interval", "min": "-inf", "max": 100}


def test_int_interval_full():
    """Test int_interval with min and max."""
    result = int_interval(0, 255)
    assert result == {"type": "int-interval", "min": 0, "max": 255}


def test_int_interval_unbounded():
    """Test int_interval without bounds."""
    result = int_interval()
    assert result == {"type": "int-interval", "min": "-inf", "max": "inf"}


def test_union_single():
    """Test union with single item."""
    result = union("Image")
    assert result == {"type": "union", "items": ["Image"]}


def test_union_multiple():
    """Test union with multiple items."""
    result = union("Image", "Video", "Audio")
    assert result == {"type": "union", "items": ["Image", "Video", "Audio"]}


def test_intersect_single():
    """Test intersect with single item."""
    result = intersect("Image")
    assert result == {"type": "intersection", "items": ["Image"]}


def test_intersect_multiple():
    """Test intersect with multiple items."""
    result = intersect("Image", "Metadata")
    assert result == {"type": "intersection", "items": ["Image", "Metadata"]}


def test_intersect_with_error_single():
    """Test intersect_with_error with single item."""
    result = intersect_with_error("Image")
    assert result == {
        "type": "union",
        "items": [
            {"type": "intersection", "items": ["Image"]},
            {"type": "intersection", "items": ["Error", "Image"]},
        ],
    }


def test_intersect_with_error_multiple():
    """Test intersect_with_error with multiple items."""
    result = intersect_with_error("Image", "Video")
    expected_items = [
        {"type": "intersection", "items": ["Image", "Video"]},
        {"type": "intersection", "items": ["Error", "Image"]},
        {"type": "intersection", "items": ["Error", "Video"]},
    ]
    assert result == {"type": "union", "items": expected_items}


def test_named_without_fields():
    """Test named expression without fields."""
    result = named("Image")
    assert result == {"type": "named", "name": "Image", "fields": None}


def test_named_with_fields():
    """Test named expression with fields."""
    result = named("Image", {"width": 100, "height": 200})
    assert result == {
        "type": "named",
        "name": "Image",
        "fields": {"width": 100, "height": 200},
    }


def test_field_access():
    """Test field access expression."""
    result = field("myImage", "width")
    assert result == {"type": "field-access", "of": "myImage", "field": "width"}


def test_fn_no_args():
    """Test function call without arguments."""
    result = fn("sqrt")
    assert result == {"type": "function-call", "name": "sqrt", "args": []}


def test_fn_with_args():
    """Test function call with arguments."""
    result = fn("add", 1, 2)
    assert result == {"type": "function-call", "name": "add", "args": [1, 2]}


def test_match_single_arm():
    """Test match expression with single arm."""
    result = match("value", ("pattern1", None, "result1"))
    assert result == {
        "type": "match",
        "of": "value",
        "arms": [{"pattern": "pattern1", "binding": None, "to": "result1"}],
    }


def test_match_multiple_arms():
    """Test match expression with multiple arms."""
    result = match(
        "value",
        ("pattern1", None, "result1"),
        ("pattern2", "x", "result2"),
    )
    assert result == {
        "type": "match",
        "of": "value",
        "arms": [
            {"pattern": "pattern1", "binding": None, "to": "result1"},
            {"pattern": "pattern2", "binding": "x", "to": "result2"},
        ],
    }


def test_match_with_default():
    """Test match expression with default case."""
    result = match("value", ("pattern1", None, "result1"), default="default_result")
    assert result == {
        "type": "match",
        "of": "value",
        "arms": [
            {"pattern": "pattern1", "binding": None, "to": "result1"},
            {"pattern": "any", "binding": None, "to": "default_result"},
        ],
    }


def test_image_no_fields():
    """Test Image helper with no fields."""
    result = Image()
    assert result == {"type": "named", "name": "Image", "fields": {}}


def test_image_with_dimensions():
    """Test Image helper with width, height, and channels."""
    result = Image(width=100, height=200, channels=3)
    assert result == {
        "type": "named",
        "name": "Image",
        "fields": {"width": 100, "height": 200, "channels": 3},
    }


def test_image_with_width_as():
    """Test Image helper with width_as field."""
    result = Image(width_as="input")
    assert result == {
        "type": "named",
        "name": "Image",
        "fields": {"width": {"type": "field-access", "of": "input", "field": "width"}},
    }


def test_image_with_height_as():
    """Test Image helper with height_as field."""
    result = Image(height_as="input")
    assert result == {
        "type": "named",
        "name": "Image",
        "fields": {
            "height": {"type": "field-access", "of": "input", "field": "height"}
        },
    }


def test_image_with_channels_as():
    """Test Image helper with channels_as field."""
    result = Image(channels_as="input")
    assert result == {
        "type": "named",
        "name": "Image",
        "fields": {
            "channels": {"type": "field-access", "of": "input", "field": "channels"}
        },
    }


def test_image_with_size_as():
    """Test Image helper with size_as field."""
    result = Image(size_as="input")
    assert result == {
        "type": "named",
        "name": "Image",
        "fields": {
            "width": {"type": "field-access", "of": "input", "field": "width"},
            "height": {"type": "field-access", "of": "input", "field": "height"},
        },
    }


def test_color_no_fields():
    """Test Color helper with no fields."""
    result = Color()
    assert result == {"type": "named", "name": "Color", "fields": {}}


def test_color_with_channels():
    """Test Color helper with channels field."""
    result = Color(channels=3)
    assert result == {"type": "named", "name": "Color", "fields": {"channels": 3}}


def test_color_with_channels_as():
    """Test Color helper with channels_as field."""
    result = Color(channels_as="input")
    assert result == {
        "type": "named",
        "name": "Color",
        "fields": {
            "channels": {"type": "field-access", "of": "input", "field": "channels"}
        },
    }
