import electronLog from 'electron-log';
import { app, dialog } from 'electron/main';
import { log } from '../../common/log';
import { lazy } from '../../common/util';
import { OpenArguments, parseArgs } from '../arguments';
import { openSaveFile } from '../SaveFile';
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

    const hasInstanceLock = settings.allowMultipleInstances || app.requestSingleInstanceLock();
    if (!hasInstanceLock) {
        app.quit();
        return;
    }

    // Store reference to main window for second-instance handler
    // It will be set when the window is created
    let mainWindowRef: Electron.BrowserWindow | null = null;

    // Register second-instance handler immediately after getting the lock
    // This prevents race conditions where a second instance is attempted
    // before the handler is registered in createMainWindow
    if (!settings.allowMultipleInstances) {
        app.on('second-instance', (_event, commandLine) => {
            (async () => {
                // If window hasn't been created yet, ignore the second instance attempt
                // The window will be created by the first instance shortly
                if (!mainWindowRef || mainWindowRef.isDestroyed()) {
                    log.warn('Second instance attempted before main window was created');
                    return;
                }

                const { file } = parseArgs(commandLine.slice(app.isPackaged ? 2 : 3));
                if (file) {
                    const result = await openSaveFile(file);
                    mainWindowRef.webContents.send('file-open', result);
                }
                // Focus main window if a second instance was attempted
                if (mainWindowRef.isMinimized()) mainWindowRef.restore();
                mainWindowRef.focus();
            })().catch(log.error);
        });
    }

    const createWindow = lazy(() => {
        createMainWindow(args, settings)
            .then((window) => {
                // Store the window reference for the second-instance handler
                mainWindowRef = window;
            })
            .catch((error) => {
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
