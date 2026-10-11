import { BrowserWindow, OpenDialogOptions, OpenDialogReturnValue, dialog } from 'electron/main';
import path from 'path';

// Since Electron 43, an open dialog without a `defaultPath` starts in Downloads and the OS no
// longer remembers the last folder, so we remember it ourselves.
let lastDirectory: string | undefined;

/**
 * Like `dialog.showOpenDialog`, but an unset or empty `defaultPath` falls back to the folder of
 * the last open dialog.
 */
export const showOpenDialog = async (
    window: BrowserWindow,
    options: OpenDialogOptions
): Promise<OpenDialogReturnValue> => {
    const result = await dialog.showOpenDialog(window, {
        ...options,
        defaultPath: options.defaultPath || lastDirectory,
    });
    const [first] = result.filePaths;
    if (!result.canceled && first) {
        lastDirectory = options.properties?.includes('openDirectory') ? first : path.dirname(first);
    }
    return result;
};
