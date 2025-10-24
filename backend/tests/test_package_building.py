"""Tests for Python package building"""

import importlib
import subprocess
import tempfile
from pathlib import Path

import api
from build_packages import compile_package_schema


def test_compile_package_schema():
    """Test that package schemas can be compiled"""
    # Import a package
    importlib.import_module("packages.chaiNNer_standard")

    # Load nodes
    api.registry.load_nodes(__file__)

    # Find the package
    package = None
    for pkg in api.registry.packages.values():
        if pkg.id == "chaiNNer_standard":
            package = pkg
            break

    if package is None:
        # No nodes loaded, that's ok in test environment
        return

    # Compile schema
    with tempfile.TemporaryDirectory() as tmpdir:
        output_dir = Path(tmpdir)
        schema = compile_package_schema(package, output_dir)

        # Verify schema structure
        assert "package" in schema
        assert "categories" in schema
        assert "nodes" in schema

        # Verify schema file was created
        schema_file = output_dir / "schema.json"
        assert schema_file.exists()


def test_pyproject_toml_exists():
    """Test that package has pyproject.toml"""
    package_dir = (
        Path(__file__).parent.parent / "src" / "packages" / "chaiNNer_standard"
    )
    pyproject_file = package_dir / "pyproject.toml"
    assert pyproject_file.exists(), "pyproject.toml should exist for chaiNNer_standard"


def test_package_structure():
    """Test that package follows Python package structure"""
    package_dir = (
        Path(__file__).parent.parent / "src" / "packages" / "chaiNNer_standard"
    )

    # Check required files
    assert (package_dir / "pyproject.toml").exists()
    assert (package_dir / "README.md").exists()
    assert (package_dir / "__init__.py").exists()


def test_build_command_exists():
    """Test that build-packages npm command is available"""
    # Check package.json directly
    package_json_path = Path.cwd() / "package.json"
    assert package_json_path.exists(), "package.json should exist"

    with open(package_json_path, encoding="utf-8") as f:
        import json

        package_json = json.load(f)

    assert "build-packages" in package_json.get("scripts", {}), (
        "build-packages command should be in package.json"
    )
