"""Tests for api.group module."""

from __future__ import annotations

from typing import Any, cast

from api.group import Group, GroupId, GroupInfo, group
from api.input import BaseInput
from api.types import InputId


class DummyInput(BaseInput):
    """A dummy input for testing purposes."""

    def __init__(self, label: str, input_id: int = -1):
        super().__init__("number", label)
        self.id = InputId(input_id)

    def to_dict(self):
        return {
            "id": self.id,
            "type": self.input_type,
            "label": self.label,
        }


class TestGroupInfo:
    """Tests for the GroupInfo class."""

    def test_group_info_creation(self):
        """Test creating a GroupInfo instance."""
        info = GroupInfo(
            group_id=GroupId(1),
            kind="conditional",
        )

        assert info.id == 1
        assert info.kind == "conditional"
        assert info.options == {}

    def test_group_info_with_options(self):
        """Test creating a GroupInfo with options."""
        options = {"key": "value", "number": 42}
        info = GroupInfo(
            group_id=GroupId(2),
            kind="optional",
            options=options,
        )

        assert info.id == 2
        assert info.kind == "optional"
        assert info.options == options

    def test_group_info_options_default_to_empty_dict(self):
        """Test that options default to an empty dict."""
        info = GroupInfo(GroupId(3), "test")
        assert info.options == {}

    def test_group_info_with_none_options(self):
        """Test that None options become an empty dict."""
        info = GroupInfo(GroupId(4), "test", options=None)
        assert info.options == {}


class TestGroup:
    """Tests for the Group class."""

    def test_group_creation(self):
        """Test creating a Group instance."""
        info = GroupInfo(GroupId(1), "test")
        items = [1, 2, 3]
        grp = Group(info, items)

        assert grp.info == info
        assert grp.items == items

    def test_group_to_dict_with_simple_items(self):
        """Test to_dict with simple items."""
        info = GroupInfo(GroupId(1), "conditional")
        items = [InputId(1), InputId(2)]
        grp = Group(info, items)

        result = grp.to_dict()

        assert result["id"] == 1
        assert result["kind"] == "conditional"
        assert result["options"] == {}
        assert result["items"] == [InputId(1), InputId(2)]

    def test_group_to_dict_with_input_items(self):
        """Test to_dict with BaseInput items."""
        info = GroupInfo(GroupId(2), "optional")
        input1 = DummyInput("Input 1", 1)
        input2 = DummyInput("Input 2", 2)
        grp = Group(info, [input1, input2])

        result = grp.to_dict()

        assert result["id"] == 2
        assert result["kind"] == "optional"
        # Items are returned as-is, not converted to dict for BaseInput
        items = result["items"]
        assert isinstance(items, list)
        assert items[0] == input1
        assert items[1] == input2

    def test_group_to_dict_with_nested_group(self):
        """Test to_dict with nested groups."""
        inner_info = GroupInfo(GroupId(1), "inner")
        inner_group = Group(inner_info, [InputId(1), InputId(2)])

        outer_info = GroupInfo(GroupId(2), "outer")
        outer_group = Group(outer_info, [inner_group, InputId(3)])

        result = outer_group.to_dict()

        assert result["id"] == 2
        assert result["kind"] == "outer"
        items = cast(list[Any], result["items"])
        assert len(items) == 2
        # First item should be the nested group dict
        first_item = items[0]
        assert isinstance(first_item, dict)
        assert first_item["id"] == 1
        assert first_item["kind"] == "inner"
        # Second item should be the InputId
        assert items[1] == InputId(3)

    def test_group_with_options(self):
        """Test group with options in to_dict."""
        options = {"min": 1, "max": 10}
        info = GroupInfo(GroupId(3), "range", options=options)
        grp = Group(info, [InputId(1)])

        result = grp.to_dict()

        assert result["options"] == {"min": 1, "max": 10}


class TestGroupFunction:
    """Tests for the group() function."""

    def test_group_function_basic(self):
        """Test the basic group() function."""
        input1 = DummyInput("Input 1", 1)
        input2 = DummyInput("Input 2", 2)

        grp_func = group("conditional")
        result = grp_func(input1, input2)

        assert isinstance(result, Group)
        assert result.info.kind == "conditional"
        assert len(result.items) == 2
        assert result.items[0] == input1
        assert result.items[1] == input2

    def test_group_function_with_options(self):
        """Test group() function with options."""
        options = {"collapsible": True}
        grp_func = group("optional", options=options)
        input1 = DummyInput("Input", 1)
        result = grp_func(input1)

        assert result.info.options == options

    def test_group_function_with_custom_id(self):
        """Test group() function with custom id."""
        grp_func = group("test", id=42)
        input1 = DummyInput("Input", 1)
        result = grp_func(input1)

        assert result.info.id == 42

    def test_group_function_default_id(self):
        """Test that group() function has default id of -1."""
        grp_func = group("test")
        input1 = DummyInput("Input", 1)
        result = grp_func(input1)

        assert result.info.id == -1

    def test_group_function_with_nested_groups(self):
        """Test group() function with nested groups."""
        inner_func = group("inner")
        input1 = DummyInput("Input 1", 1)
        input2 = DummyInput("Input 2", 2)
        inner = inner_func(input1, input2)

        outer_func = group("outer")
        input3 = DummyInput("Input 3", 3)
        result = outer_func(inner, input3)

        assert isinstance(result, Group)
        assert len(result.items) == 2
        assert isinstance(result.items[0], Group)
        assert result.items[0] == inner
        assert result.items[1] == input3

    def test_group_function_returns_nested_group_type(self):
        """Test that group() returns NestedGroup."""
        grp_func = group("test")
        input1 = DummyInput("Input", 1)
        result = grp_func(input1)

        # Check that the result is compatible with NestedGroup type
        assert isinstance(result, Group)
        assert all(isinstance(item, BaseInput | Group) for item in result.items)

    def test_group_function_with_no_items(self):
        """Test group() function with no items."""
        grp_func = group("empty")
        result = grp_func()

        assert isinstance(result, Group)
        assert result.items == []

    def test_group_function_multiple_calls(self):
        """Test that multiple calls to the same group function create separate groups."""
        grp_func = group("test")

        input1 = DummyInput("Input 1", 1)
        input2 = DummyInput("Input 2", 2)

        result1 = grp_func(input1)
        result2 = grp_func(input2)

        assert result1 is not result2
        assert result1.items != result2.items
        assert result1.items == [input1]
        assert result2.items == [input2]
