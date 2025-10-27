# Backend Testing Guide

This directory contains comprehensive tests for the chaiNNer backend functionality.

## Test Coverage

The test suite covers:

- **Chain execution** (`test_chain.py`, `test_executor.py`)
- **Iterator system** (`test_iterator.py`, `test_generator_exception_handling.py`)
  - Generator classes (from_list, from_range, from_iter)
  - Collector functionality
  - Exception handling during iteration
- **Event system** (`test_events.py`)
- **Server configuration** (`test_server_config.py`)
- **JSON serialization** (`test_chain_json.py`)
- **Utilities** (`test_util.py`, `test_response.py`, `test_logger.py`)

## Running Tests

### Prerequisites

Install test dependencies:

```bash
pip install pytest pytest-asyncio pytest-cov
```

### Run All Tests

From the repository root:

```bash
python3 -m pytest backend/tests/
```

### Run with Verbose Output

```bash
python3 -m pytest backend/tests/ -v
```

### Run Specific Test File

```bash
python3 -m pytest backend/tests/test_iterator.py
```

### Run Specific Test

```bash
python3 -m pytest backend/tests/test_iterator.py::TestGeneratorFromList::test_basic_list_mapping
```

## Code Coverage

### Generate Coverage Report

Run tests with coverage:

```bash
python3 -m pytest backend/tests/ --cov=backend/src --cov-report=term
```

### Generate HTML Coverage Report

```bash
python3 -m pytest backend/tests/ --cov=backend/src --cov-report=html
```

This creates an `htmlcov/` directory with detailed coverage information. Open `htmlcov/index.html` in a browser to view.

### Coverage Configuration

Coverage settings are configured in `pyproject.toml`:

- Source directories are specified
- Packages and node implementations are excluded (as they're tested via integration)
- Common exclusion patterns are defined (abstract methods, type checking, etc.)

### Current Coverage

As of the latest tests:
- **105 test cases**
- **50.46% overall coverage** of core backend code
- Key areas covered:
  - `api/iter.py`: 100% (Generator and Collector)
  - `chain/input.py`: 100%
  - `events.py`: 97.87%
  - `response.py`: 96.15%
  - `server_config.py`: 100%

Areas with lower coverage (process.py, api modules) require more complex integration testing or involve server-specific code.

## Test Structure

### Test Classes

Tests are organized into classes by functionality:

```python
class TestGeneratorFromList:
    """Test Generator.from_list functionality."""
    
    def test_basic_list_mapping(self):
        """Test basic list mapping with simple function."""
        # Test implementation
```

### Fixtures

Common test fixtures are defined using pytest:

```python
@pytest.fixture
def executor_setup(event_loop):
    """Create basic executor setup for tests."""
    # Setup code
    yield setup_data
    # Cleanup code
```

### Async Tests

Async tests use the `@pytest.mark.asyncio` decorator:

```python
@pytest.mark.asyncio
async def test_empty_chain_execution(self, executor_setup):
    """Test executing an empty chain."""
    # Async test implementation
```

## Writing New Tests

When adding new tests:

1. Follow existing naming conventions (`test_*.py`)
2. Use descriptive test names that explain what is being tested
3. Include docstrings explaining the test purpose
4. Organize related tests into classes
5. Use appropriate fixtures for setup/teardown
6. Test both success and error cases
7. Keep tests focused and independent

### Example Test

```python
def test_generator_basic_functionality(self):
    """Test that Generator produces correct output."""
    gen = Generator.from_list([1, 2, 3], lambda x, i: x * 2)
    results = list(gen.supplier())
    
    assert results == [2, 4, 6]
    assert gen.expected_length == 3
```

## Continuous Integration

Tests should be run as part of CI/CD pipelines to ensure code quality. The test suite is designed to be fast and reliable for automated testing.

## Contributing

When contributing new backend functionality:

1. Write tests for new features
2. Ensure existing tests still pass
3. Aim to maintain or improve code coverage
4. Document any new test patterns or fixtures
