/* eslint-disable @typescript-eslint/no-explicit-any, no-console, @typescript-eslint/no-unsafe-argument */
/**
 * Mock for electron-log/renderer in web mode
 */

// Create a simple console-based logger
export const electronLog = {
    error: (...args: any[]) => console.error(...args),
    warn: (...args: any[]) => console.warn(...args),
    info: (...args: any[]) => console.info(...args),
    verbose: (...args: any[]) => console.log(...args),
    debug: (...args: any[]) => console.debug(...args),
    silly: (...args: any[]) => console.log(...args),
    log: (...args: any[]) => console.log(...args),
    transports: {
        ipc: { level: 'info' },
        console: { level: 'debug' },
    },
};
