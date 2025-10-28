"""
Tests for the Transformer class.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

# Import Transformer directly from api.iter without triggering api.__init__
backend_src = Path(__file__).parent.parent / "src"
spec = importlib.util.spec_from_file_location(
    "api.iter", backend_src / "api" / "iter.py"
)
assert spec is not None, "Failed to load module spec"
assert spec.loader is not None, "Module spec has no loader"
iter_module = importlib.util.module_from_spec(spec)
sys.modules["api.iter"] = iter_module
spec.loader.exec_module(iter_module)

Transformer = iter_module.Transformer


class TestTransformer:
    """Test Transformer functionality."""

    def test_transformer_creation(self):
        """Test creating a basic transformer."""

        def identity_transform(x: int) -> list[int]:
            return [x]

        transformer = Transformer(transform=identity_transform)
        result = transformer.transform(5)

        assert result == [5]

    def test_transformer_filter(self):
        """Test a transformer that filters values."""

        def filter_even(x: int) -> list[int]:
            if x % 2 == 0:
                return [x]
            return []

        transformer = Transformer(transform=filter_even)

        assert transformer.transform(2) == [2]
        assert transformer.transform(3) == []
        assert transformer.transform(4) == [4]

    def test_transformer_duplicate(self):
        """Test a transformer that duplicates values."""

        def duplicate(x: int) -> list[int]:
            return [x, x]

        transformer = Transformer(transform=duplicate)
        result = transformer.transform(5)

        assert result == [5, 5]

    def test_transformer_expand(self):
        """Test a transformer that expands to multiple values."""

        def expand_range(x: int) -> list[int]:
            return list(range(x))

        transformer = Transformer(transform=expand_range)

        assert transformer.transform(0) == []
        assert transformer.transform(1) == [0]
        assert transformer.transform(3) == [0, 1, 2]
        assert transformer.transform(5) == [0, 1, 2, 3, 4]

    def test_transformer_with_complex_types(self):
        """Test transformer with complex input/output types."""

        def transform_tuple(t: tuple[int, str]) -> list[str]:
            num, text = t
            return [f"{text}_{i}" for i in range(num)]

        transformer = Transformer(transform=transform_tuple)
        result = transformer.transform((3, "item"))

        assert result == ["item_0", "item_1", "item_2"]

    def test_transformer_limit(self):
        """Test a transformer that limits sequence length."""

        class LimitTransformer:
            def __init__(self, max_count: int):
                self.max_count = max_count
                self.count = 0

            def transform(self, x: int) -> list[int]:
                if self.count < self.max_count:
                    self.count += 1
                    return [x]
                return []

        limiter = LimitTransformer(3)
        transformer = Transformer(transform=limiter.transform)

        assert transformer.transform(1) == [1]
        assert transformer.transform(2) == [2]
        assert transformer.transform(3) == [3]
        assert transformer.transform(4) == []
        assert transformer.transform(5) == []
