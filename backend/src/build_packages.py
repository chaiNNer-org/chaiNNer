#!/usr/bin/env python3
"""
Package Builder for chaiNNer Packages

This script builds chaiNNer packages as standalone Python packages with:
- Compiled node schemas (JSON)
- Runtime node code
- Package metadata

Each package becomes a distributable Python package that can be:
- Installed via pip
- Distributed independently
- Imported programmatically
"""

from __future__ import annotations

import argparse
import importlib
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import api
from api import Group
from logger import logger, setup_logger

# Initialize logger
setup_logger("build_packages")


def compile_package_schema(package: api.Package, output_dir: Path) -> dict[str, Any]:
    """
    Compile a single package's schemas to JSON.

    Returns the schema dictionary.
    """
    package_nodes = []
    package_categories = []

    for category in package.categories:
        # Add category info
        package_categories.append(category.to_dict())

        # Add all nodes in this category
        for node_group in category.node_groups:
            for node in node_group.nodes:
                schema = {
                    "schemaId": node.schema_id,
                    "name": node.name,
                    "category": node_group.category.id,
                    "nodeGroup": node_group.id,
                    "inputs": [x.to_dict() for x in node.inputs],
                    "outputs": [x.to_dict() for x in node.outputs],
                    "groupLayout": [
                        g.to_dict() if isinstance(g, Group) else g
                        for g in node.group_layout
                    ],
                    "iteratorInputs": [x.to_dict() for x in node.iterable_inputs],
                    "iteratorOutputs": [x.to_dict() for x in node.iterable_outputs],
                    "keyInfo": node.key_info.to_dict() if node.key_info else None,
                    "suggestions": [x.to_dict() for x in node.suggestions],
                    "description": node.description,
                    "seeAlso": node.see_also,
                    "icon": node.icon,
                    "kind": node.kind,
                    "hasSideEffects": node.side_effects,
                    "deprecated": node.deprecated,
                    "features": node.features,
                }
                package_nodes.append(schema)

    # Create package schema
    package_schema = {
        "package": package.to_dict(),
        "categories": package_categories,
        "nodes": package_nodes,
    }

    # Write schema to output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    schema_file = output_dir / "schema.json"
    with open(schema_file, "w", encoding="utf-8") as f:
        json.dump(package_schema, f, indent=2, ensure_ascii=False)

    logger.info(
        "Compiled %d node(s) for package %s to %s",
        len(package_nodes),
        package.id,
        schema_file,
    )

    return package_schema


def build_package(package_dir: Path, output_dir: Path | None = None) -> int:
    """
    Build a chaiNNer package as a standalone Python package.

    Steps:
    1. Import the package to load node definitions
    2. Compile node schemas to JSON
    3. Build the Python package using setuptools

    Returns:
        0 on success, non-zero on failure
    """
    try:
        package_name = package_dir.name
        logger.info("Building package: %s", package_name)

        # Import the package to register nodes
        relative_path = package_dir.relative_to(Path(__file__).parent)
        module_name = str(relative_path).replace("/", ".").replace("\\", ".")

        logger.info("Importing module: %s", module_name)
        try:
            importlib.import_module(module_name)
        except Exception as e:
            logger.warning("Failed to import %s: %s", module_name, e)
            logger.info("Continuing with available nodes...")

        # Load nodes
        load_errors = api.registry.load_nodes(__file__)
        if load_errors:
            logger.warning(
                "Failed to load %d node(s), continuing with available nodes",
                len(load_errors),
            )

        # Find the package in the registry
        package = None
        for pkg in api.registry.packages.values():
            if Path(pkg.where).parent.name == package_name:
                package = pkg
                break

        if package is None:
            logger.error("Package %s not found in registry", package_name)
            return 1

        # Compile schemas
        schema_output_dir = package_dir / "chainner_standard"
        if not schema_output_dir.exists():
            # Create a proper Python package structure
            schema_output_dir.mkdir(parents=True, exist_ok=True)
            (schema_output_dir / "__init__.py").touch()

        compile_package_schema(package, schema_output_dir)

        # Build the Python package
        logger.info("Building Python package...")
        result = subprocess.run(
            [sys.executable, "-m", "build", str(package_dir)],
            check=False,
            capture_output=True,
            text=True,
        )

        if result.returncode != 0:
            logger.error("Build failed: %s", result.stderr)
            return 1

        logger.info("Package built successfully!")
        if result.stdout:
            logger.info(result.stdout)

        # Copy build artifacts if output_dir specified
        if output_dir:
            output_dir.mkdir(parents=True, exist_ok=True)
            dist_dir = package_dir / "dist"
            if dist_dir.exists():
                for file in dist_dir.iterdir():
                    shutil.copy2(file, output_dir / file.name)
                    logger.info("Copied %s to %s", file.name, output_dir)

        return 0

    except Exception as e:
        logger.error("Failed to build package: %s", e, exc_info=True)
        return 1


def build_all_packages(output_dir: Path | None = None) -> int:
    """Build all chaiNNer packages."""
    packages_dir = Path(__file__).parent / "packages"

    if not packages_dir.exists():
        logger.error("Packages directory not found: %s", packages_dir)
        return 1

    success_count = 0
    fail_count = 0

    for package_dir in packages_dir.iterdir():
        if not package_dir.is_dir():
            continue
        if package_dir.name.startswith("_"):
            continue

        # Check if package has pyproject.toml
        if not (package_dir / "pyproject.toml").exists():
            logger.warning("Skipping %s: no pyproject.toml found", package_dir.name)
            continue

        result = build_package(package_dir, output_dir)
        if result == 0:
            success_count += 1
        else:
            fail_count += 1

    logger.info("Build complete: %d succeeded, %d failed", success_count, fail_count)
    return 0 if fail_count == 0 else 1


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build chaiNNer packages as standalone Python packages"
    )
    parser.add_argument(
        "--package",
        type=Path,
        help="Specific package directory to build",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Directory to copy build artifacts to",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Build all packages",
    )

    args = parser.parse_args()

    if args.all or (args.package is None):
        return build_all_packages(args.output_dir)
    else:
        return build_package(args.package, args.output_dir)


if __name__ == "__main__":
    sys.exit(main())
