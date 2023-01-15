/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { ChildProcessWithoutNullStreams } from 'child_process';
import { BrowserWindow, app, dialog, nativeTheme, powerSaveBlocker, shell } from 'electron';
import log from 'electron-log';
import { readdirSync, rmSync } from 'fs';
import { t } from 'i18next';
import { LocalStorage } from 'node-localstorage';
import os from 'os';
import path from 'path';
import './i18n';
import { Version, WindowSize } from '../common/common-types';
import { BrowserWindowWithSafeIpc, ipcMain } from '../common/safeIpc';
import { SaveFile, openSaveFile } from '../common/SaveFile';
import { CriticalError } from '../common/ui/error';
import { ProgressController, ProgressToken, SubProgress } from '../common/ui/progress';
import { lazy } from '../common/util';
import { getArguments, parseArgs } from './arguments';
import { BackendProcess } from './backend/process';
import { setupBackend } from './backend/setup';
import { MenuData, setMainMenu } from './menu';
import { createNvidiaSmiVRamChecker, getNvidiaGpuNames, getNvidiaSmi } from './nvidiaSmi';
import { getRootDir, getRootDirSync } from './platform';
import { addSplashScreen } from './splash';
import { getGpuInfo } from './systemInfo';
import { hasUpdate } from './update';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line global-require
if (require('electron-squirrel-startup')) {
    app.quit();
}

const version = app.getVersion() as Version;

const hasInstanceLock = app.requestSingleInstanceLock();

if (!hasInstanceLock) {
    app.quit();
}

const localStorageLocation = path.join(getRootDirSync(), 'settings');
ipcMain.handle('get-localstorage-location', () => localStorageLocation);
const localStorage = new LocalStorage(localStorageLocation);

const lastWindowSize = JSON.parse(
    localStorage.getItem('use-last-window-size') || 'null'
) as WindowSize | null;
const disableHardwareAcceleration = localStorage.getItem('disable-hw-accel') === 'true';
if (disableHardwareAcceleration) {
    app.disableHardwareAcceleration();
}

// log.transports.file.resolvePath = () => path.join(app.getAppPath(), 'logs/main.log');
log.transports.file.resolvePath = (variables) =>
    path.join(variables.electronDefaultDir!, variables.fileName!);
log.transports.file.level = 'info';

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
            });
    },
});

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// Check for update
const checkForUpdate = () => {
    hasUpdate(version)
        .then(async (latest) => {
            if (!latest) return;

            const splitBody = latest.body.split('\n');
            const changelogItems = splitBody.filter(
                (line) => line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')
            );

            const buttonResult = await dialog.showMessageBox(BrowserWindow.getFocusedWindow()!, {
                type: 'info',
                title: 'An update is available for chaiNNer!',
                message: `Version ${latest.version} is available for download from GitHub.`,
                detail: `Currently installed: ${version}\n\nRelease notes:\n\n${changelogItems.join(
                    '\n'
                )}`,
                buttons: [`Get version ${latest.version}`, 'Ok'],
                defaultId: 1,
            });
            if (buttonResult.response === 0) {
                await shell.openExternal(latest.releaseUrl);
                app.exit();
            }
        })
        .catch((reason) => log.error(reason));
};

const registerEventHandlers = (mainWindow: BrowserWindowWithSafeIpc, backend: BackendProcess) => {
    ipcMain.handle('owns-backend', () => backend.owned);
    ipcMain.handle('get-port', () => backend.port);
    ipcMain.handle('get-python', () => backend.python);

    if (backend.owned) {
        backend.addErrorListener((error) => {
            const messageBoxOptions = {
                type: 'error',
                title: 'Unexpected Error',
                message: `The Python backend encountered an unexpected error. ChaiNNer will now exit. Error: ${String(
                    error
                )}`,
            };
            dialog.showMessageBoxSync(messageBoxOptions);
            app.exit(1);
        });

        app.on('before-quit', () => backend.tryKill());
    }

    ipcMain.handle('relaunch-application', () => {
        if (backend.owned) {
            backend.tryKill();
        }
        app.relaunch();
        app.exit();
    });

    ipcMain.handle('restart-backend', () => {
        if (backend.owned) {
            backend.restart();
        } else {
            log.warn('Tried to restart non-owned backend');
        }
    });

    ipcMain.handle('dir-select', (event, dirPath) =>
        dialog.showOpenDialog(mainWindow, {
            defaultPath: dirPath,
            properties: ['openDirectory', 'createDirectory'],
        })
    );

    ipcMain.handle('file-select', (event, filters, allowMultiple = false, dirPath = undefined) =>
        dialog.showOpenDialog(mainWindow, {
            filters: [...filters, { name: 'All Files', extensions: ['*'] }],
            defaultPath: dirPath,
            properties: allowMultiple ? ['openFile', 'multiSelections'] : ['openFile'],
        })
    );

    ipcMain.handle('file-save-as-json', async (event, saveData, defaultPath) => {
        try {
            const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
                title: 'Save Chain File',
                filters: [{ name: 'Chain File', extensions: ['chn'] }],
                defaultPath,
            });
            if (!canceled && filePath) {
                await SaveFile.write(filePath, saveData, version);
                return { kind: 'Success', path: filePath };
            }
            return { kind: 'Canceled' };
        } catch (error) {
            log.error(error);
            throw error;
        }
    });

    ipcMain.handle('file-save-json', async (event, saveData, savePath) => {
        try {
            await SaveFile.write(savePath, saveData, version);
        } catch (error) {
            log.error(error);
            throw error;
        }
    });

    ipcMain.handle('quit-application', () => {
        app.exit();
    });

    // ipcMain.handle('relaunch-application', async () => {
    //   app.relaunch();
    //   app.exit();
    // });

    ipcMain.handle('get-gpu-info', getGpuInfo);

    ipcMain.handle('get-app-version', () => version);

    ipcMain.handle('get-appdata', () => app.getPath('userData'));

    let blockerId: number | undefined;
    ipcMain.on('start-sleep-blocker', () => {
        if (blockerId === undefined) {
            blockerId = powerSaveBlocker.start('prevent-app-suspension');
        }
    });
    ipcMain.on('stop-sleep-blocker', () => {
        if (blockerId !== undefined) {
            powerSaveBlocker.stop(blockerId);
            blockerId = undefined;
        }
    });

    ipcMain.handle('open-url', (event, url) => shell.openExternal(url));

    // Set the progress bar on the taskbar. 0-1 = progress, > 1 = indeterminate, -1 = none
    ipcMain.on('set-progress-bar', (event, progress) => {
        try {
            mainWindow.setProgressBar(progress ?? -1);
        } catch (err) {
            log.error(err);
        }
    });
};

const checkNvidiaSmi = async () => {
    const registerEmptyGpuEvents = () => {
        ipcMain.handle('get-nvidia-gpu-name', () => null);
        ipcMain.handle('get-nvidia-gpus', () => null);
        ipcMain.handle('get-vram-usage', () => null);
    };

    const registerNvidiaSmiEvents = async (nvidiaSmi: string) => {
        const nvidiaGpus = await getNvidiaGpuNames(nvidiaSmi);
        ipcMain.handle('get-nvidia-gpu-name', () => nvidiaGpus[0].trim());
        ipcMain.handle('get-nvidia-gpus', () => nvidiaGpus.map((gpu) => gpu.trim()));

        let vramChecker: ChildProcessWithoutNullStreams | undefined;
        let lastVRam: number | null = null;
        ipcMain.handle('get-vram-usage', () => {
            if (!vramChecker) {
                vramChecker = createNvidiaSmiVRamChecker(nvidiaSmi, 1000, (usage) => {
                    lastVRam = usage;
                });
            }

            return lastVRam;
        });
    };

    const nvidiaSmi = await getNvidiaSmi();

    if (nvidiaSmi) {
        try {
            await registerNvidiaSmiEvents(nvidiaSmi);
            return true;
        } catch (error) {
            log.error(error);
        }
    }
    registerEmptyGpuEvents();
    return false;
};

const nvidiaSmiPromise = checkNvidiaSmi();
const getRootDirPromise = getRootDir();

const createBackend = async (token: ProgressToken) => {
    const useSystemPython = localStorage.getItem('use-system-python') === 'true';
    const systemPythonLocation = localStorage.getItem('system-python-location');

    return setupBackend(
        token,
        useSystemPython,
        systemPythonLocation,
        () => nvidiaSmiPromise,
        () => getRootDirPromise
    );
};

const createWindow = lazy(async () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: lastWindowSize?.width ?? 1280,
        height: lastWindowSize?.height ?? 720,
        backgroundColor: '#1A202C',
        minWidth: 720,
        minHeight: 640,
        darkTheme: nativeTheme.shouldUseDarkColors,
        roundedCorners: true,
        webPreferences: {
            webSecurity: false,
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
            contextIsolation: false,
        },
        icon: `${__dirname}/../public/icons/cross_platform/icon`,
        show: false,
    }) as BrowserWindowWithSafeIpc;

    const menuData: MenuData = { openRecentRev: [] };
    setMainMenu({ mainWindow, menuData, enabled: true });
    ipcMain.on('update-open-recent-menu', (_, openRecent) => {
        menuData.openRecentRev = openRecent;
        setMainMenu({ mainWindow, menuData, enabled: true });
    });
    ipcMain.on('disable-menu', () => {
        setMainMenu({ mainWindow, menuData, enabled: false });
    });
    ipcMain.on('enable-menu', () => {
        setMainMenu({ mainWindow, menuData, enabled: true });
    });

    const progressController = new ProgressController();
    addSplashScreen(progressController);

    try {
        const backend = await createBackend(SubProgress.slice(progressController, 0, 0.9));
        registerEventHandlers(mainWindow, backend);

        progressController.submitProgress({
            status: t('splash.loadingApp', 'Loading main application...'),
        });

        if (mainWindow.isDestroyed()) {
            return;
        }

        ipcMain.once('backend-ready', () => {
            progressController.submitProgress({ totalProgress: 1 });

            mainWindow.show();
            if (lastWindowSize?.maximized) {
                mainWindow.maximize();
            }
            const checkUpdateOnStartup = localStorage.getItem('check-upd-on-strtup') === 'true';
            if (app.isPackaged && checkUpdateOnStartup) {
                checkForUpdate();
            }
        });

        // and load the index.html of the app.
        mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY).catch((error) => log.error(error));
    } catch (error) {
        if (error instanceof CriticalError) {
            await progressController.submitInterrupt(error.interrupt);
        } else {
            log.error(error);
            await progressController.submitInterrupt({
                type: 'critical error',
                message: 'Unable to setup backend due to unknown.',
            });
        }

        return;
    }

    // Open the DevTools.
    if (!app.isPackaged && !mainWindow.isDestroyed()) {
        mainWindow.webContents.openDevTools();
    }

    let hasUnsavedChanges = false;
    ipcMain.on('update-has-unsaved-changes', (_, value) => {
        hasUnsavedChanges = value;
    });
    let forceExit = false;
    ipcMain.on('exit-after-save', () => {
        forceExit = true;
        mainWindow.close();
    });

    mainWindow.on('close', (event) => {
        if (forceExit) {
            // we want to exit and nothing in here may stop this
            return;
        }
        if (hasUnsavedChanges) {
            const choice = dialog.showMessageBoxSync(mainWindow, {
                type: 'question',
                title: 'Unsaved changes',
                message: 'The current chain has unsaved changes.',
                buttons: ['&Save', "Do&n't Save", 'Cancel'],
                defaultId: 0,
                cancelId: 2,
                noLink: true,
                normalizeAccessKeys: true,
            });
            if (choice === 1) {
                // Don't save, so do nothing
            } else if (choice === 2) {
                // Cancel
                event.preventDefault();
            } else {
                // Save
                event.preventDefault();
                mainWindow.webContents.send('save-before-exit');
            }
        }
    });

    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window-maximized-change', true);
    });
    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window-maximized-change', false);
    });
    mainWindow.on('blur', () => {
        mainWindow.webContents.send('window-blur');
    });

    // Opening file with chaiNNer
    const { file: filepath } = getArguments();
    if (filepath) {
        const result = openSaveFile(filepath);
        ipcMain.handle('get-cli-open', () => result);
    } else {
        ipcMain.handle('get-cli-open', () => undefined);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.on('second-instance', async (_event, commandLine, _workingDirectory) => {
        const { file } = parseArgs(commandLine.slice(app.isPackaged ? 2 : 3));
        if (file) {
            const result = await openSaveFile(file);
            mainWindow.webContents.send('file-open', result);
        }
        // Focus main window if a second instance was attempted
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    });
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('quit', () => {
    log.info('Cleaning up temp folders...');
    const tempDir = os.tmpdir();
    // find all the folders starting with 'chaiNNer-'
    const tempFolders = readdirSync(tempDir, { withFileTypes: true })
        .filter((dir) => dir.isDirectory())
        .map((dir) => dir.name)
        .filter((name) => name.includes('chaiNNer-'));
    tempFolders.forEach((folder) => {
        try {
            rmSync(path.join(tempDir, folder), { force: true, recursive: true });
        } catch (error) {
            log.error(`Error removing temp folder. ${String(error)}`);
        }
    });
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

process.on('uncaughtException', (err) => {
    const messageBoxOptions = {
        type: 'error',
        title: 'Error in Main process',
        message: `Something failed: ${String(err)}`,
    };
    dialog.showMessageBoxSync(messageBoxOptions);
    app.exit(1);
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
