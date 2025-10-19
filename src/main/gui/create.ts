import electronLog from 'electron-log';
import { app, dialog } from 'electron/main';
import { log } from '../../common/log';
import { lazy } from '../../common/util';
import { OpenArguments } from '../arguments';
import { readSettings } from '../setting-storage';
import { createMainWindow } from './main-window';

const mdCodeBlock = (code: string): string => {
    return `\`\`\`\n${code}\n\`\`\``;
};

const setupErrorHandling = () => {
    electronLog.errorHandler.startCatching({
        showDialog: false,
        onError: ({ createIssue, error, versions }) => {
            dialog
                .showMessageBox({
                    title: 'An error occurred',
                    message: error.message,
                    detail: error.stack,
                    type: 'error',
                    buttons: ['Ignore', 'Report', 'Exit'],
                })
                .then((result) => {
                    if (result.response === 1) {
                        const stack = error.stack
                            ? `\n${error.stack.replace(String(error), '')}`
                            : '';
                        createIssue('https://github.com/chaiNNer-org/chaiNNer/issues/new', {
                            title: `Error report: ${error.message}`,
                            body: [
                                mdCodeBlock(String(error) + stack),
                                `ChaiNNer: ${String(versions.app)}`,
                                `OS: ${String(versions.os)}`,
                            ].join('\n'),
                        });
                    } else if (result.response === 2) {
                        app.quit();
                    }
                })
                .catch(log.error);
        },
    });
};

export const createGuiApp = (args: OpenArguments) => {
    setupErrorHandling();

    const settings = readSettings();
    if (!settings.hardwareAcceleration) {
        app.disableHardwareAcceleration();
    }

    // When allowMultipleInstances is true, we don't request the lock, but we still
    // need to know if this instance should write settings. Only the first instance
    // (the one that would have gotten the lock) should write settings.
    let canWriteSettings = true;
    if (settings.allowMultipleInstances) {
        // Try to get the lock to determine if we're the first instance
        const hasLock = app.requestSingleInstanceLock();
        if (hasLock) {
            // We got the lock, so we're the first instance and can write settings
            canWriteSettings = true;
            // Release the lock since we want to allow multiple instances
            app.releaseSingleInstanceLock();
        } else {
            // Another instance has the lock, so we shouldn't write settings
            canWriteSettings = false;
        }
    } else {
        // Single instance mode - try to get the lock
        const hasInstanceLock = app.requestSingleInstanceLock();
        if (!hasInstanceLock) {
            app.quit();
            return;
        }
        canWriteSettings = true;
    }

    const createWindow = lazy(() => {
        createMainWindow(args, settings, canWriteSettings).catch((error) => {
            log.error(error);
            // rethrow to let the global error handler deal with it
            return Promise.reject(error);
        });
    });

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', createWindow);

    // TODO: See if this can be fixed in the future. Currently an active app with
    // no windows doesn't spawn a new window. Due to the windows creation being
    // lazy. Not using lazy does result in the backend not starting.
    /**
    app.on('activate', () => {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
    * */

    // Quit when all windows are closed.
    app.on('window-all-closed', () => {
        app.quit();
    });
};
