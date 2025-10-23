# Testing ChaiNNer Frontend Without Electron

This directory contains tools and resources for testing the chaiNNer frontend without Electron, enabling automated frontend tests with tools like Playwright.

## Overview

The chaiNNer frontend has been enhanced to support running in two modes:

1. **Electron Mode** (default): The traditional way chaiNNer runs as a desktop application
2. **Web Mode**: Running in a standard web browser without Electron dependencies

## Running the Frontend in Web Mode

### With Mock Backend

To run the frontend with a mock backend server (no real backend dependencies needed):

```bash
npm run dev:web:mock
```

This will:
- Start a lightweight Python mock backend server on port 8000
- Start the Vite development server for the frontend
- Open the frontend in your browser at http://localhost:5173

### With Real Backend

To run the frontend with the real backend:

```bash
npm run dev:web
```

This will:
- Start the real Python backend (requires Python and dependencies installed)
- Start the Vite development server for the frontend

### Frontend Only

To run just the frontend (you need to start the backend separately):

```bash
npm run frontend:web
```

## Mock Backend

The mock backend (`mock-backend.py`) provides minimal API endpoints needed for the frontend to function:

- `/nodes` - Returns a few test nodes
- `/python-info` - Returns mock Python information
- `/status` - Returns backend status
- `/packages` - Returns empty package list
- `/features` - Returns empty feature list

You can run it independently:

```bash
python tests/mock-backend.py [port]
```

Default port is 8000.

## Architecture

The web mode implementation includes:

1. **Environment Detection** (`src/renderer/isElectron.ts`): Detects whether running in Electron or web browser
2. **Mock IPC** (`src/renderer/mockIpc.ts`): Provides mock implementations of Electron IPC calls
3. **Mock Electron Modules** (`src/renderer/mocks/`): Mock implementations of electron modules
4. **Web-only Vite Config** (`vite.config.web.ts`): Standalone Vite configuration for web mode

## Testing with Playwright

With the frontend running in web mode, you can now use Playwright for automated frontend tests:

```javascript
import { test, expect } from '@playwright/test';

test('test frontend', async ({ page }) => {
  await page.goto('http://localhost:5173');
  // Your test code here
});
```

## Limitations in Web Mode

Some features are not available in web mode:

- File system access (file dialogs, file operations)
- Native clipboard operations (advanced formats)
- System shell integration
- Application quit/restart
- Window management

These operations will either:
- Use browser alternatives where possible (e.g., navigator.clipboard for text)
- Return mocked responses
- Log warnings to the console

## Development Notes

- The web mode is primarily intended for testing purposes
- All changes maintain backward compatibility with Electron mode
- Mock implementations log their calls to the console for debugging
- Settings are stored in localStorage in web mode instead of the file system
