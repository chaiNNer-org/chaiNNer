import { BrowserWindow, app, dialog } from 'electron';
import log from 'electron-log';
import { lazy } from '../../common/util';
import { OpenArguments } from '../arguments';
import { settingStorage } from '../setting-storage';
import { createMainWindow } from './main-window';

const setupErrorHandling = () => {
    log.catchErrors({
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
                        submitIssue!('https://github.com/chaiNNer-org/chaiNNer/issues/new', {
                            title: `Error report: ${error.message}`,
                            body: [
                                `\`\`\`\n${String(error)}\n\`\`\``,
                                `ChaiNNer: ${String(versions?.app)}`,
                                `OS: ${String(versions?.os)}`,
                            ].join('\n'),
                        });
                    } else if (result.response === 2) {
                        app.quit();
                    }
                })
                .catch((e) => log.error(e));
        },
    });

    process.on('uncaughtException', (error) => {
        dialog.showMessageBoxSync({
            type: 'error',
            title: 'Error in Main process',
            message: `Something failed: ${String(error)}`,
        });
        app.exit(1);
    });
};

export const createGuiApp = (args: OpenArguments) => {
    setupErrorHandling();

    const disableHardwareAcceleration = settingStorage.getItem('disable-hw-accel') === 'true';
    if (disableHardwareAcceleration) {
        app.disableHardwareAcceleration();
    }

    const hasInstanceLock = app.requestSingleInstanceLock();
    if (!hasInstanceLock) {
        app.quit();
    }

    const createWindow = lazy(() => {
        createMainWindow(args).catch((error) => log.error(error));
    });

    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', createWindow);

    app.on('activate', () => {
        // On OS X it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // Quit when all windows are closed, except on macOS. There, it's common
    // for applications and their menu bar to stay active until the user quits
    // explicitly with Cmd + Q.
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
};
