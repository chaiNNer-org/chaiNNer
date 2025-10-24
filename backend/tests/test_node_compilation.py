"""Tests for node schema compilation"""

import json
import tempfile
from pathlib import Path

from compile_nodes import compile_nodes


def test_compile_nodes_creates_output_directory():
    """Test that compile_nodes creates the output directory if it doesn't exist"""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir) / "schemas" / "nested"
        assert not output_dir.exists()

        result = compile_nodes(output_dir)

        assert output_dir.exists()
        assert result == 0  # Success


def test_compile_nodes_creates_json_files():
    """Test that compile_nodes creates JSON files for each package"""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir)

        result = compile_nodes(output_dir)

        assert result == 0  # Success

        # Check that JSON files were created
        json_files = list(output_dir.glob("*.json"))
        assert len(json_files) > 0

        # Check that standard packages exist
        expected_packages = ["chaiNNer_standard", "chaiNNer_ncnn", "chaiNNer_external"]
        for package_name in expected_packages:
            package_file = output_dir / f"{package_name}.json"
            assert package_file.exists(), f"Missing {package_name}.json"


def test_compiled_schema_structure():
    """Test that compiled schemas have the expected structure"""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir)

        result = compile_nodes(output_dir)
        assert result == 0

        # Check structure of one of the JSON files
        schema_file = output_dir / "chaiNNer_standard.json"
        assert schema_file.exists()

        with open(schema_file, encoding="utf-8") as f:
            data = json.load(f)

        # Verify top-level structure
        assert "package" in data
        assert "categories" in data
        assert "nodes" in data

        # Verify package structure
        package = data["package"]
        assert "id" in package
        assert "name" in package
        assert "description" in package
        assert "dependencies" in package

        # Verify categories is a list
        assert isinstance(data["categories"], list)

        # Verify nodes is a list
        assert isinstance(data["nodes"], list)


def test_node_schema_fields():
    """Test that node schemas contain all required fields"""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir)

        result = compile_nodes(output_dir)
        assert result == 0

        # Find a JSON file with nodes
        for json_file in output_dir.glob("*.json"):
            with open(json_file, encoding="utf-8") as f:
                data = json.load(f)

            # If this package has nodes, test their structure
            if data["nodes"]:
                node = data["nodes"][0]

                # Check required fields
                required_fields = [
                    "schemaId",
                    "name",
                    "category",
                    "nodeGroup",
                    "inputs",
                    "outputs",
                    "groupLayout",
                    "iteratorInputs",
                    "iteratorOutputs",
                    "description",
                    "icon",
                    "kind",
                ]

                for field in required_fields:
                    assert field in node, f"Missing field {field} in node schema"

                # Verify field types
                assert isinstance(node["inputs"], list)
                assert isinstance(node["outputs"], list)
                assert isinstance(node["iteratorInputs"], list)
                assert isinstance(node["iteratorOutputs"], list)

                # If we found a node with fields, we're done
                break


def test_compile_nodes_handles_missing_dependencies():
    """Test that compilation continues even when dependencies are missing"""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir)

        # Even with missing dependencies, compilation should succeed
        result = compile_nodes(output_dir)

        # Should return 0 (success) even with missing dependencies
        assert result == 0

        # Should still create JSON files
        json_files = list(output_dir.glob("*.json"))
        assert len(json_files) > 0
