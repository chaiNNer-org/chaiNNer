import { app, dialog } from 'electron';
import electronLog from 'electron-log';
import { log } from '../../common/log';
import { lazy } from '../../common/util';
import { OpenArguments } from '../arguments';
import { settingStorage } from '../setting-storage';
import { createMainWindow } from './main-window';

const mdCodeBlock = (code: string): string => {
    return `\`\`\`\n${code}\n\`\`\``;
};

const setupErrorHandling = () => {
    electronLog.catchErrors({
        showDialog: false,
        onError: (error, versions, submitIssue) => {
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

                        submitIssue!('https://github.com/chaiNNer-org/chaiNNer/issues/new', {
                            title: `Error report: ${error.message}`,
                            body: [
                                mdCodeBlock(String(error) + stack),
                                `ChaiNNer: ${String(versions?.app)}`,
                                `OS: ${String(versions?.os)}`,
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

    const isEnableHardwareAcceleration =
        settingStorage.getItem('enable-hardware-acceleration') === 'true';

    if (!isEnableHardwareAcceleration) {
        app.disableHardwareAcceleration();
    }

    const hasInstanceLock = app.requestSingleInstanceLock();
    if (!hasInstanceLock) {
        app.quit();
    }

    const createWindow = lazy(() => {
        createMainWindow(args).catch((error) => {
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
