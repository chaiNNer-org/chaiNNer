/**
 * Pre-loaded application constants from the main process.
 * These are loaded synchronously during preload and exposed directly to the renderer.
 */

export const { appVersion, isMac, isArmMac, appDataPath } = window.appConstants;
