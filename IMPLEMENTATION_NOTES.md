# ChaiNNer Frontend: Web Mode for Testing

## Overview

This PR implements the ability to run the chaiNNer frontend without Electron, enabling automated frontend testing with tools like Playwright. The implementation maintains full backward compatibility with the existing Electron-based application.

## Problem Statement

Previously, chaiNNer required Electron to run, which made it difficult to:
- Set up automated frontend tests with modern testing frameworks like Playwright
- Test the frontend in isolation from the backend
- Run quick frontend-only development iterations

## Solution

The frontend now supports two modes:

### 1. Electron Mode (Default)
The traditional way chaiNNer runs as a desktop application. No changes to existing behavior.

### 2. Web Mode (New)
Run the frontend in a standard web browser without Electron dependencies.

## Implementation Details

### Core Components

1. **Environment Detection** (`src/renderer/isElectron.ts`)
   - Detects whether running in Electron or browser
   - Based on the presence of `window.unsafeIpcRenderer`

2. **Mock IPC** (`src/renderer/mockIpc.ts`)
   - Provides stub implementations for all Electron IPC channels
   - Uses localStorage for settings persistence
   - Falls back to browser APIs where possible (e.g., navigator.clipboard)
   - Logs mock operations to console for debugging

3. **Mock Electron Modules** (`src/renderer/mocks/`)
   - `electron-common.ts`: Mocks clipboard, nativeImage, shell
   - `electron-renderer.ts`: Mocks IPC renderer types
   - `electron-log.ts`: Console-based logging

4. **App Constants** (`src/renderer/appConstants.ts`)
   - Updated to provide mock constants in web mode
   - Version: "0.0.0-web"
   - Platform detection disabled

5. **Standalone Vite Config** (`vite.config.web.ts`)
   - Separate configuration for web-only builds
   - Aliases Electron modules to mock implementations
   - Outputs to `dist-web/` directory

6. **Mock Backend** (`tests/mock-backend.py`)
   - Lightweight Python HTTP server
   - Provides minimal API endpoints needed for frontend
   - Includes a few test nodes (text input/output, number input)
   - No real backend dependencies required

### Development Scripts

```bash
# Run frontend only in web mode
npm run frontend:web

# Run with real backend (requires Python setup)
npm run dev:web

# Run with mock backend (no Python dependencies needed)
npm run dev:web:mock

# Start mock backend independently
npm run mock-backend
```

### Testing with Playwright

The web mode enables Playwright testing. Example configuration in `tests/e2e/README.md`:

```typescript
import { test, expect } from '@playwright/test';

test('should load the application', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('#root');
  const root = page.locator('#root');
  await expect(root).toBeVisible();
});
```

## Limitations in Web Mode

Some features are intentionally limited or unavailable:

- **File System**: No access to file dialogs or file operations
- **Clipboard**: Only text copy/paste (no advanced formats)
- **Native Features**: No shell integration, window management, or system quit
- **Settings**: Stored in localStorage instead of file system

These limitations are acceptable for testing purposes.

## Code Changes

### Modified Files
- `package.json`: Added new scripts
- `src/globals.d.ts`: Made window properties optional
- `src/renderer/index.tsx`: Conditional electron-log import
- `src/renderer/safeIpc.ts`: Uses mock IPC in web mode
- `src/renderer/appConstants.ts`: Provides mock constants
- `.gitignore`: Excludes dist-web build artifacts

### New Files
- `src/renderer/isElectron.ts`: Environment detection
- `src/renderer/mockIpc.ts`: Mock IPC implementation
- `src/renderer/mocks/*.ts`: Mock Electron modules
- `vite.config.web.ts`: Web-only Vite configuration
- `index-web.html`: Entry point for web mode
- `tests/mock-backend.py`: Mock backend server
- `tests/README.md`: Testing documentation
- `tests/e2e/README.md`: Playwright setup guide

## Quality Checks

✅ All existing tests pass
✅ Linting passes (ESLint, StyleLint)
✅ Type checking passes (TypeScript)
✅ Security scan passes (CodeQL - 0 vulnerabilities)
✅ Build succeeds for both Electron and web modes
✅ Backward compatibility maintained

## Future Work

This implementation enables:
- Writing Playwright tests for the frontend
- CI/CD integration for automated frontend testing
- Faster frontend development iterations
- Testing different node configurations easily

The mock backend can be extended with more test nodes as needed for specific test scenarios.

## Migration Guide

No migration needed! This is fully backward compatible. Existing Electron mode works exactly as before.

To start using web mode for testing:
1. Install Playwright: `npm install -D @playwright/test`
2. Start the mock backend: `npm run dev:web:mock`
3. Write tests following examples in `tests/e2e/README.md`
