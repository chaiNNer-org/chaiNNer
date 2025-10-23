/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Mock for electron/renderer module in web mode
 */

// Export empty IpcRendererEvent type
export type IpcRendererEvent = any;

// Export other types that might be imported
export const ipcRenderer = {};
