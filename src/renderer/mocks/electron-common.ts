/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-misused-promises */
/**
 * Mock for electron/common module in web mode
 */

// Export empty objects/functions for electron common modules
export const clipboard = {
    writeText: (text: string) => navigator.clipboard.writeText(text),
    readText: () => navigator.clipboard.readText() || Promise.resolve(''),
};

export const nativeImage = {
    createFromDataURL: () => ({}),
};

export const shell = {
    openExternal: (url: string) => {
        window.open(url, '_blank');
    },
};

// Export types that might be imported
export type FileFilter = any;
export type OpenDialogReturnValue = any;
