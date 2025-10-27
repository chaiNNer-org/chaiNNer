"""Tests for api.output module."""

from __future__ import annotations

import pytest

from api.output import BaseOutput
from api.types import InputId, OutputId


class TestBaseOutput:
    """Tests for the BaseOutput class."""

    def test_base_output_creation(self):
        """Test creating a BaseOutput instance."""
        output = BaseOutput(
            output_type="number",
            label="Test Output",
        )

        assert output.output_type == "number"
        assert output.label == "Test Output"
        assert output.id == -1
        assert output.never_reason is None
        assert output.kind == "generic"
        assert output.has_handle is True
        assert output.passthrough_of is None
        assert output.associated_type is None
        assert output.description is None
        assert output.should_suggest is False

    def test_base_output_with_kind(self):
        """Test creating a BaseOutput with specific kind."""
        output = BaseOutput(
            output_type="Image",
            label="Image Output",
            kind="large-image",
        )

        assert output.kind == "large-image"

    def test_base_output_with_no_handle(self):
        """Test creating a BaseOutput without handle."""
        output = BaseOutput(
            output_type="number",
            label="No Handle Output",
            has_handle=False,
        )

        assert output.has_handle is False

    def test_base_output_with_associated_type(self):
        """Test creating a BaseOutput with associated type."""
        output = BaseOutput(
            output_type="number",
            label="Typed Output",
            associated_type=int,
        )

        assert output.associated_type == int

    def test_with_id(self):
        """Test the with_id method."""
        output = BaseOutput(output_type="number", label="Test")
        result = output.with_id(5)

        assert result is output  # Returns self
        assert output.id == 5

    def test_with_id_from_output_id(self):
        """Test with_id using OutputId type."""
        output = BaseOutput(output_type="number", label="Test")
        output.with_id(OutputId(10))

        assert output.id == 10

    def test_with_never_reason(self):
        """Test the with_never_reason method."""
        output = BaseOutput(output_type="number", label="Test")
        result = output.with_never_reason("Not available")

        assert result is output  # Returns self
        assert output.never_reason == "Not available"

    def test_with_docs_single_line(self):
        """Test with_docs with a single line."""
        output = BaseOutput(output_type="number", label="Test")
        result = output.with_docs("This is a test output.")

        assert result is output  # Returns self
        assert output.description == "This is a test output."

    def test_with_docs_multiple_lines(self):
        """Test with_docs with multiple lines."""
        output = BaseOutput(output_type="number", label="Test")
        result = output.with_docs("Line 1", "Line 2", "Line 3")

        assert result is output  # Returns self
        assert output.description == "Line 1\n\nLine 2\n\nLine 3"

    def test_suggest(self):
        """Test the suggest method."""
        output = BaseOutput(output_type="number", label="Test")
        result = output.suggest()

        assert result is output  # Returns self
        assert output.should_suggest is True

    def test_as_passthrough_of(self):
        """Test the as_passthrough_of method."""
        output = BaseOutput(output_type="number", label="Test")
        result = output.as_passthrough_of(3)

        assert result is output  # Returns self
        assert output.passthrough_of == 3

    def test_as_passthrough_of_with_input_id(self):
        """Test as_passthrough_of with InputId type."""
        output = BaseOutput(output_type="number", label="Test")
        output.as_passthrough_of(InputId(7))

        assert output.passthrough_of == 7

    def test_to_dict(self):
        """Test the to_dict method."""
        output = BaseOutput(
            output_type="number",
            label="Test Output",
        )
        output.with_id(1)
        output.with_never_reason("test reason")
        output.with_docs("Test description")
        output.suggest()
        output.as_passthrough_of(2)

        result = output.to_dict()

        assert result["id"] == 1
        assert result["type"] == "number"
        assert result["label"] == "Test Output"
        assert result["neverReason"] == "test reason"
        assert result["kind"] == "generic"
        assert result["hasHandle"] is True
        assert result["passthroughOf"] == 2
        assert result["description"] == "Test description"
        assert result["suggest"] is True

    def test_to_dict_minimal(self):
        """Test to_dict with minimal configuration."""
        output = BaseOutput(output_type="string", label="Simple")
        output.with_id(0)

        result = output.to_dict()

        assert result["id"] == 0
        assert result["type"] == "string"
        assert result["label"] == "Simple"
        assert result["neverReason"] is None
        assert result["kind"] == "generic"
        assert result["hasHandle"] is True
        assert result["passthroughOf"] is None
        assert result["description"] is None
        assert result["suggest"] is False

    def test_get_broadcast_data(self):
        """Test the get_broadcast_data method (default returns None)."""
        output = BaseOutput(output_type="number", label="Test")
        result = output.get_broadcast_data(42)

        assert result is None

    def test_get_broadcast_type(self):
        """Test the get_broadcast_type method (default returns None)."""
        output = BaseOutput(output_type="number", label="Test")
        result = output.get_broadcast_type(42)

        assert result is None

    def test_enforce(self):
        """Test the enforce method."""
        output = BaseOutput(output_type="number", label="Test")

        # Non-None values should pass through
        assert output.enforce(42) == 42
        assert output.enforce("hello") == "hello"
        assert output.enforce([1, 2, 3]) == [1, 2, 3]

    def test_enforce_with_none_raises(self):
        """Test that enforce raises an assertion error for None."""
        output = BaseOutput(output_type="number", label="Test")

        with pytest.raises(AssertionError):
            output.enforce(None)

    def test_method_chaining(self):
        """Test that methods can be chained."""
        output = (
            BaseOutput(output_type="number", label="Test")
            .with_id(1)
            .with_never_reason("reason")
            .with_docs("description")
            .suggest()
            .as_passthrough_of(2)
        )

        assert output.id == 1
        assert output.never_reason == "reason"
        assert output.description == "description"
        assert output.should_suggest is True
        assert output.passthrough_of == 2

    def test_tagged_output_kind(self):
        """Test creating output with tagged kind."""
        output = BaseOutput(
            output_type="string",
            label="Tagged Output",
            kind="tagged",
        )

        assert output.kind == "tagged"
