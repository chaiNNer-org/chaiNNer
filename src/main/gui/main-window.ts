import { ChildProcessWithoutNullStreams } from 'child_process';
import { BrowserWindow, app, dialog, nativeTheme, powerSaveBlocker, shell } from 'electron';
import EventSource from 'eventsource';
import { t } from 'i18next';
import { Version, WindowSize } from '../../common/common-types';
import { log } from '../../common/log';
import { BrowserWindowWithSafeIpc, ipcMain } from '../../common/safeIpc';
import { SaveFile, openSaveFile } from '../../common/SaveFile';
import { BackendEventMap } from '../../common/Backend';
import { CriticalError } from '../../common/ui/error';
import { ProgressController, ProgressToken, SubProgress } from '../../common/ui/progress';
import { OpenArguments, parseArgs } from '../arguments';
import { BackendProcess } from '../backend/process';
import { setupBackend } from '../backend/setup';
import { createNvidiaSmiVRamChecker, getNvidiaGpuNames, getNvidiaSmi } from '../nvidiaSmi';
import { getRootDirSync } from '../platform';
import { settingStorage, settingStorageLocation } from '../setting-storage';
import { getGpuInfo } from '../systemInfo';
import { hasUpdate } from '../update';
import { MenuData, setMainMenu } from './menu';
import { addSplashScreen } from './splash';

const version = app.getVersion() as Version;

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
            }
        })
        .catch(log.error);
};

const registerEventHandlerPreSetup = (
    mainWindow: BrowserWindowWithSafeIpc,
    args: OpenArguments
) => {
    ipcMain.handle('get-app-version', () => version);
    ipcMain.handle('get-appdata', () => getRootDirSync());
    ipcMain.handle('get-gpu-info', getGpuInfo);
    ipcMain.handle('get-localstorage-location', () => settingStorageLocation);
    ipcMain.handle('refresh-nodes', () => args.refresh);

    // menu
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

    // dialogs
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

    // file IO
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

    // sleep
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

    // window events
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
    if (args.file) {
        const result = openSaveFile(args.file);
        ipcMain.handle('get-cli-open', () => result);
    } else {
        ipcMain.handle('get-cli-open', () => undefined);
    }

    app.on('second-instance', (_event, commandLine) => {
        (async () => {
            const { file } = parseArgs(commandLine.slice(app.isPackaged ? 2 : 3));
            if (file) {
                const result = await openSaveFile(file);
                mainWindow.webContents.send('file-open', result);
            }
            // Focus main window if a second instance was attempted
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        })().catch(log.error);
    });
};

const registerEventHandlerPostSetup = (
    mainWindow: BrowserWindowWithSafeIpc,
    backend: BackendProcess
) => {
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

const createBackend = async (token: ProgressToken, args: OpenArguments) => {
    const useSystemPython = settingStorage.getItem('use-system-python') === 'true';
    const systemPythonLocation = settingStorage.getItem('system-python-location');

    const nvidiaSmiPromise = checkNvidiaSmi();

    return setupBackend(
        token,
        useSystemPython,
        systemPythonLocation,
        () => nvidiaSmiPromise,
        getRootDirSync(),
        args.noBackend
    );
};

export const createMainWindow = async (args: OpenArguments) => {
    const lastWindowSize = JSON.parse(
        settingStorage.getItem('use-last-window-size') || 'null'
    ) as WindowSize | null;

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

    const progressController = new ProgressController();
    addSplashScreen(progressController);

    try {
        registerEventHandlerPreSetup(mainWindow, args);
        const backend = await createBackend(SubProgress.slice(progressController, 0, 0.5), args);
        registerEventHandlerPostSetup(mainWindow, backend);

        const sse = new EventSource(`http://127.0.0.1:${backend.port}/setup-sse`, {
            withCredentials: true,
        });
        sse.onopen = () => {
            log.info('Successfully connected to setup SSE.');
        };

        sse.addEventListener('backend-started', () => {
            mainWindow.webContents.send('backend-started');
        });

        const backendStatusProgressSlice = SubProgress.slice(progressController, 0.5, 0.95);
        sse.addEventListener('backend-status', (e: MessageEvent<string>) => {
            if (e.data) {
                const data = JSON.parse(e.data) as BackendEventMap['backend-status'];
                backendStatusProgressSlice.submitProgress({
                    status: data.message,
                    totalProgress: data.progress,
                    statusProgress: data.statusProgress,
                });
            }
        });

        sse.addEventListener('backend-ready', () => {
            progressController.submitProgress({
                totalProgress: 1,
                status: t('splash.loadingApp', 'Loading main application...'),
            });

            if (mainWindow.isDestroyed()) {
                dialog.showMessageBoxSync({
                    type: 'error',
                    title: 'Unable to start application',
                    message: 'The main window was closed before the backend was ready.',
                });
                app.quit();
                return;
            }

            mainWindow.show();
            if (lastWindowSize?.maximized) {
                mainWindow.maximize();
            }
            const checkUpdateOnStartup = settingStorage.getItem('check-upd-on-strtup') === 'true';
            if (app.isPackaged && checkUpdateOnStartup) {
                checkForUpdate();
            }
        });

        if (mainWindow.isDestroyed()) {
            return;
        }

        // and load the index.html of the app.
        mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY).catch(log.error);
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
    if (args.devtools && !mainWindow.isDestroyed()) {
        mainWindow.webContents.openDevTools();
    }
};
