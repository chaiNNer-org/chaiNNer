/**
 * Detects if the app is running in Electron or in a web browser.
 */
export const isElectron = (): boolean => {
    // Check if we're running in Electron
    // In Electron, window.unsafeIpcRenderer will be exposed via preload
    return typeof window !== 'undefined' && 'unsafeIpcRenderer' in window;
};

export const isWeb = (): boolean => {
    return !isElectron();
};
