# chaiNNer Standard Package

Standard nodes package for chaiNNer, containing core image processing and utility nodes.

## Package Structure

This package is structured as a standalone Python package that can be:
- Built and distributed independently
- Compiled to generate node schemas
- Imported as a standard Python package

## Building

```bash
python -m build
```

This will create:
- Compiled node schemas (JSON)
- Distributable wheel package

## Installation

```bash
pip install .
```

## Development

```bash
pip install -e ".[dev]"
```
