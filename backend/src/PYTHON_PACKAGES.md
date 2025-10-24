# Python Package Architecture for chaiNNer

## Overview

This document describes the Python package architecture for chaiNNer, where each node package (e.g., `chaiNNer_standard`, `chaiNNer_pytorch`) is structured as a standalone, distributable Python package.

## Architecture

### Package Structure

Each package follows standard Python packaging conventions:

```
chaiNNer_standard/
├── pyproject.toml          # Package metadata and dependencies
├── README.md               # Package documentation
├── chainner_standard/      # Python package directory
│   ├── __init__.py        # Package initialization
│   ├── schema.json        # Compiled node schemas
│   ├── image/             # Node categories
│   ├── utility/
│   └── ...
```

### Benefits

1. **Independent Distribution**: Each package can be distributed separately
2. **Version Management**: Packages have their own versioning
3. **Dependency Isolation**: Package-specific dependencies are clearly defined
4. **SDK Ready**: Foundation for a package development SDK
5. **Backward Compatible**: Works with existing development workflow

## Building Packages

### Build a Single Package

```bash
python ./backend/src/build_packages.py --package ./backend/src/packages/chaiNNer_standard
```

### Build All Packages

```bash
npm run build-packages
```

This will:
1. Import each package to load node definitions
2. Compile node schemas to JSON
3. Build wheel files using setuptools
4. Output to `backend/dist/`

### Development Mode

For development, packages are still loaded from source:

```bash
npm run dev
```

The system automatically detects and uses source packages.

## Package Distribution

### Installing a Built Package

```bash
pip install backend/dist/chainner_standard-0.1.0-py3-none-any.whl
```

### Using Installed Packages

When installed, packages are imported like any Python package:

```python
import chainner_standard
```

The system automatically:
1. Detects installed packages
2. Loads compiled schemas from the package
3. Uses the package's runtime code for node execution

## Package Loading Priority

The system loads packages in this order:

1. **Installed Python Package**: If package is installed via pip
2. **Source Package**: If running in development mode
3. **Compiled Schemas**: Fallback for documentation when package can't load

## Creating New Packages

### Step 1: Create Package Structure

```bash
mkdir -p backend/src/packages/my_package
cd backend/src/packages/my_package
```

### Step 2: Create pyproject.toml

```toml
[build-system]
requires = ["setuptools>=68.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "chainner-my-package"
version = "0.1.0"
description = "My custom nodes for chaiNNer"
requires-python = ">=3.8"
dependencies = [
    # Your dependencies here
]

[tool.setuptools]
packages = ["chainner_my_package"]
```

### Step 3: Implement Nodes

Follow existing node patterns in `backend/src/packages/chaiNNer_standard/`

### Step 4: Build the Package

```bash
python ./backend/src/build_packages.py --package ./backend/src/packages/my_package
```

## Schema Format

Each built package includes a `schema.json` file containing:

```json
{
  "package": {
    "id": "package_id",
    "name": "Package Name",
    "description": "...",
    "dependencies": [...]
  },
  "categories": [...],
  "nodes": [
    {
      "schemaId": "package:category:node",
      "name": "Node Name",
      "description": "...",
      "inputs": [...],
      "outputs": [...],
      ...
    }
  ]
}
```

## Testing

### Test a Package

```bash
cd backend/src/packages/chaiNNer_standard
pytest
```

### Test All Packages

```bash
npm run test:py
```

## CI/CD Integration

### Building in CI

```yaml
- name: Install build dependencies
  run: pip install build

- name: Build packages
  run: npm run build-packages

- name: Archive packages
  uses: actions/upload-artifact@v3
  with:
    name: packages
    path: backend/dist/*.whl
```

### Publishing Packages

Packages can be published to:
- PyPI (for public distribution)
- Private package index
- Direct download from releases

## SDK Development (Future)

This architecture enables future SDK development:

```python
# SDK for creating custom packages
from chainner_sdk import Package, Node, ImageInput, ImageOutput

package = Package(
    id="my_package",
    name="My Package",
    description="Custom nodes"
)

@package.node(
    name="My Node",
    description="Does something cool"
)
def my_node(image: ImageInput) -> ImageOutput:
    # Node implementation
    return processed_image
```

## Migration Notes

### For Existing Development

No changes needed - source packages continue to work in development mode.

### For Production/Distribution

1. Build packages: `npm run build-packages`
2. Distribute wheel files from `backend/dist/`
3. Users install: `pip install chainner-standard-0.1.0-py3-none-any.whl`

## Troubleshooting

### Package Not Found

Ensure package has `pyproject.toml` and follows naming conventions.

### Build Failures

Check that all dependencies are installed:
```bash
pip install build
```

### Import Errors

Verify package structure matches Python packaging standards.

## Related Files

- `backend/src/build_packages.py` - Package build script
- `backend/src/package_loader.py` - Package loading logic
- `backend/src/compile_nodes.py` - Legacy schema compilation (still supported)
- `backend/src/NODE_COMPILATION.md` - Original compilation documentation
