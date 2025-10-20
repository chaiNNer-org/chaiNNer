# Backend Logging System

## Overview

The chaiNNer backend now has a centralized logging system that writes logs to persistent files, independent of the frontend. This addresses the issue where all backend logs were lost if the frontend crashed.

## Features

### Separate Log Files
- **Host Process**: Logs to `host.log`
- **Worker Process**: Logs to `worker.log`

Both processes write to the same log directory, making it easy to correlate events across processes.

### Improved Timestamp Precision
Log entries include timestamps with **millisecond precision** (e.g., `2025-10-19 05:52:25.123`), allowing you to correlate events across the host and worker processes more accurately than the previous 1-second precision.

### Log Rotation
Logs are automatically rotated to prevent excessive disk usage:
- Maximum file size: 10MB per log file
- Keeps the last 5 rotated files
- Old logs are automatically deleted

### Colored Console Output
Console output includes ANSI color codes for better readability:
- DEBUG: Cyan
- INFO: Green
- WARNING: Yellow
- ERROR: Red
- CRITICAL: Magenta

## Log File Location

In production builds, logs are stored in the same location as the frontend logs:
- **Windows**: `C:\Users\<username>\AppData\Roaming\chaiNNer\logs\`
- **macOS**: `~/Library/Application Support/chaiNNer/logs/`
- **Linux**: `~/.config/chaiNNer/logs/`

For portable installations, logs are stored in the `logs/` folder next to the executable.

In development mode (when no logs directory is specified), logs fall back to:
- **All platforms**: `/tmp/chaiNNer/logs/` (or OS temp directory)

## Usage

### For Backend Developers

#### Using the Logger in Host Process Code
```python
from logger import get_logger

logger = get_logger("host")
logger.info("This is a log message from the host")
```

#### Using the Logger in Worker Process Code
```python
from logger import get_logger

logger = get_logger("worker")
logger.info("This is a log message from the worker")
```

#### Using the Logger in Shared Code
If you're writing code that might run in either the host or worker process, use `get_logger_from_env()`:

```python
from logger import get_logger_from_env

logger = get_logger_from_env()
logger.info("This message will go to the appropriate log file")
```

### Log Levels

The logger supports standard Python logging levels:
- `logger.debug("Debug message")` - Detailed information for diagnosing problems
- `logger.info("Info message")` - General informational messages
- `logger.warning("Warning message")` - Warning messages
- `logger.error("Error message")` - Error messages
- `logger.critical("Critical message")` - Critical error messages

### Custom Log Directory

You can configure a custom log directory programmatically:

```python
from pathlib import Path
from logger import setup_logger

custom_dir = Path("/path/to/logs")
logger = setup_logger("worker", log_dir=custom_dir)
```

## Log Format

### File Format
```
2025-10-19 05:52:25.123 [1234] [INFO] Logger initialized for worker process. Log file: /tmp/chaiNNer/logs/worker.log
```

Fields:
1. Timestamp with milliseconds
2. Process ID
3. Log level
4. Message

### Console Format
```
[05:52:25] [1234] [INFO] Logger initialized for worker process. Log file: /tmp/chaiNNer/logs/worker.log
```

Console format is more compact and includes colored log levels for easier reading.

## Migration from Sanic Logger

The new logging system replaces the Sanic logger (`from sanic.log import logger`). All imports have been updated to use the new centralized logger.

### Before
```python
from sanic.log import logger

logger.info("Message")
```

### After
```python
from logger import get_logger

logger = get_logger("worker")  # or "host"
logger.info("Message")
```

## Advantages

1. **Persistence**: Logs are written to files and persist even if the frontend crashes
2. **Better Correlation**: Millisecond-precision timestamps make it easier to correlate events across processes
3. **Separate but Related**: Host and worker logs are in separate files but in the same directory for easy comparison
4. **Automatic Rotation**: Prevents logs from growing indefinitely
5. **Better API**: Standard Python logging interface instead of Sanic's custom logger

## Testing

Unit tests for the logging system are in `backend/tests/test_logger.py`. Run them with:

```bash
python -m pytest backend/tests/test_logger.py -v
```
