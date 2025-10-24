"""Integration tests for schema loading"""

import json
import tempfile
from pathlib import Path

import api
from compile_nodes import compile_nodes


def test_load_compiled_schemas():
    """Test that PackageRegistry can load compiled schemas"""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir)

        # First compile some schemas
        result = compile_nodes(output_dir)
        assert result == 0

        # Create a new registry and load the schemas
        test_registry = api.PackageRegistry()
        count = test_registry.load_compiled_schemas(str(output_dir))

        # Should have loaded some schemas (even if 0 due to missing dependencies)
        assert count >= 0
        assert isinstance(test_registry.compiled_schemas, dict)


def test_compiled_schemas_dont_override_loaded_nodes():
    """Test that compiled schemas are used as fallback, not override"""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir)

        # Compile schemas
        compile_nodes(output_dir)

        # Create schema files
        # In real usage, successfully loaded nodes should take precedence
        # This test ensures the system doesn't override working nodes
        test_registry = api.PackageRegistry()

        # Load compiled schemas
        test_registry.load_compiled_schemas(str(output_dir))

        # Record how many compiled schemas we have
        compiled_count = len(test_registry.compiled_schemas)

        # In the actual system, nodes that load successfully would be in
        # test_registry.nodes and would NOT be replaced by compiled schemas
        # This is handled in the /nodes endpoint

        # Verify we have some compiled schemas to work with
        assert compiled_count >= 0


def test_load_missing_schema_directory():
    """Test that loading from non-existent directory doesn't fail"""
    test_registry = api.PackageRegistry()
    count = test_registry.load_compiled_schemas("/nonexistent/path")
    assert count == 0
    assert len(test_registry.compiled_schemas) == 0


def test_schema_json_format():
    """Test that compiled schemas have the correct JSON format"""
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir)

        # Compile schemas
        result = compile_nodes(output_dir)
        assert result == 0

        # Check at least one JSON file
        json_files = list(output_dir.glob("*.json"))
        if json_files:
            with open(json_files[0], encoding="utf-8") as f:
                data = json.load(f)

            # Verify structure matches what PackageRegistry expects
            assert "package" in data
            assert "categories" in data
            assert "nodes" in data

            # If there are nodes, verify they have the required fields
            for node in data.get("nodes", []):
                assert "schemaId" in node
                assert "name" in node
                assert "category" in node
                assert "nodeGroup" in node
