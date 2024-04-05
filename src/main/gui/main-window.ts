import { clipboard, nativeImage, shell } from 'electron/common';
import { BrowserWindow, app, dialog, nativeTheme, powerSaveBlocker } from 'electron/main';
import EventSource from 'eventsource';
import fs, { constants } from 'fs/promises';
import { t } from 'i18next';
import { BackendEventMap } from '../../common/Backend';
import { Version } from '../../common/common-types';
import { isMac } from '../../common/env';
import { log } from '../../common/log';
import { SaveFile, openSaveFile } from '../../common/SaveFile';
import { ChainnerSettings } from '../../common/settings/settings';
import { CriticalError } from '../../common/ui/error';
import { ProgressController, ProgressToken, SubProgress } from '../../common/ui/progress';
import { OpenArguments, parseArgs } from '../arguments';
import { BackendProcess } from '../backend/process';
import { setupBackend } from '../backend/setup';
import { getRootDir } from '../platform';
import { BrowserWindowWithSafeIpc, ipcMain } from '../safeIpc';
import { writeSettings } from '../setting-storage';
import { MenuData, setMainMenu } from './menu';
import { addSplashScreen } from './splash';

const version = app.getVersion() as Version;

const registerEventHandlerPreSetup = (
    mainWindow: BrowserWindowWithSafeIpc,
    args: OpenArguments,
    settings: ChainnerSettings
) => {
    ipcMain.handle('get-app-version', () => version);
    ipcMain.handle('get-appdata', () => getRootDir());
    ipcMain.handle('refresh-nodes', () => args.refresh);

    // settings
    let currentSettings = settings;
    let savingInProgress = false;
    ipcMain.handle('get-settings', () => currentSettings);
    ipcMain.handle('set-settings', (_, newSettings) => {
        currentSettings = newSettings;
        if (savingInProgress) {
            return;
        }
        savingInProgress = true;
        setTimeout(() => {
            savingInProgress = false;
            try {
                writeSettings(currentSettings);
            } catch (error) {
                log.error('Unable to save settings.', error);
            }
        }, 1000);
    });

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

    if (isMac) {
        if (globalThis.startupFile) {
            // Open file with chaiNNer on other platforms
            const result = openSaveFile(globalThis.startupFile);
            ipcMain.handle('get-auto-open', () => result);
            globalThis.startupFile = null;
        } else if (settings.startupTemplate) {
            const result = openSaveFile(settings.startupTemplate);
            ipcMain.handle('get-auto-open', () => result);
        } else {
            ipcMain.handle('get-auto-open', () => undefined);
        }
        // We remove the event we created in main.ts earlier on
        app.removeAllListeners('open-file');

        // We register this event again to handle file-opening during runtime.
        app.on('open-file', (event, filePath) => {
            event.preventDefault();
            (async () => {
                const result = await openSaveFile(filePath);
                mainWindow.webContents.send('file-open', result);
            })().catch(log.error);
        });
    } else {
        if (args.file) {
            // Open file with chaiNNer on other platforms
            const result = openSaveFile(args.file);
            ipcMain.handle('get-auto-open', () => result);
        } else if (settings.startupTemplate) {
            const result = openSaveFile(settings.startupTemplate);
            ipcMain.handle('get-auto-open', () => result);
        } else {
            ipcMain.handle('get-auto-open', () => undefined);
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
    }

    // Handle filesystem
    ipcMain.handle('fs-read-file', async (event, path, options) => fs.readFile(path, options));
    ipcMain.handle('fs-write-file', async (event, path, content, options) =>
        fs.writeFile(path, content, options)
    );
    ipcMain.handle('fs-exists', async (event, path) => {
        try {
            await fs.access(path, constants.F_OK);
            return true;
        } catch {
            return false;
        }
    });
    ipcMain.handle('fs-mkdir', async (event, path, options) => fs.mkdir(path, options));
    ipcMain.handle('fs-readdir', async (event, path) => fs.readdir(path));
    ipcMain.handle('fs-unlink', async (event, path) => fs.unlink(path));
    ipcMain.handle('fs-access', async (event, path) => fs.access(path));

    // Handle electron
    ipcMain.handle('shell-showItemInFolder', (event, fullPath) => shell.showItemInFolder(fullPath));
    ipcMain.handle('shell-openPath', (event, fullPath) => shell.openPath(fullPath));
    ipcMain.handle('app-quit', () => app.quit());
    ipcMain.handle('clipboard-writeText', (event, text) => clipboard.writeText(text));
    ipcMain.handle('clipboard-readText', () => clipboard.readText());
    ipcMain.handle('clipboard-writeBuffer', (event, format, buffer, type) =>
        clipboard.writeBuffer(format, buffer, type)
    );
    ipcMain.handle('clipboard-readBuffer', (event, format) => clipboard.readBuffer(format));
    ipcMain.handle('clipboard-availableFormats', () => clipboard.availableFormats());
    ipcMain.handle('clipboard-readHTML', () => clipboard.readHTML());
    ipcMain.handle('clipboard-readRTF', () => clipboard.readRTF());
    ipcMain.handle('clipboard-readImage', () => clipboard.readImage());
    ipcMain.handle('clipboard-writeImage', (event, image) => clipboard.writeImage(image));
    ipcMain.handle('clipboard-writeImageFromURL', (event, url) => {
        const image = nativeImage.createFromDataURL(url);
        clipboard.writeImage(image);
    });
};

const registerEventHandlerPostSetup = (
    mainWindow: BrowserWindowWithSafeIpc,
    backend: BackendProcess
) => {
    ipcMain.handle('owns-backend', () => backend.owned);
    ipcMain.handle('get-backend-url', () => backend.url);
    ipcMain.handle('get-python', () => backend.python);

    if (backend.owned) {
        backend.addErrorListener((error) => {
            dialog.showMessageBoxSync({
                type: 'error',
                title: 'Unexpected Error',
                message: `The Python backend encountered an unexpected error. ChaiNNer will now exit. Error: ${String(
                    error
                )}`,
            });
            app.exit(1);
        });

        app.on('before-quit', () => {
            backend.clearErrorListeners();
            backend.tryKill().catch(log.error);
        });
    }

    ipcMain.handle('restart-backend', async () => {
        if (backend.owned) {
            await backend.restart();
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

    const restartChainner = (): void => {
        if (backend.owned) {
            backend
                .tryKill()
                .finally(() => {
                    app.relaunch();
                    app.exit();
                })
                .catch(log.error);
        }
    };

    ipcMain.on('reboot-after-save', () => {
        restartChainner();
    });

    const handleUnsavedChanges = (
        event: Electron.Event,
        onSave: () => void,
        onDontSave?: () => void
    ) => {
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
            // Don't save
            if (onDontSave) {
                onDontSave(); // Restart the application
            }
        } else if (choice === 2) {
            // Cancel
            event.preventDefault();
        } else {
            // Save
            event.preventDefault();
            onSave();
        }
    };

    ipcMain.handle('relaunch-application', (event) => {
        if (hasUnsavedChanges) {
            handleUnsavedChanges(
                event,
                () => {
                    mainWindow.webContents.send('save-before-reboot');
                },
                () => {
                    restartChainner();
                }
            );
        } else {
            restartChainner();
        }
    });

    mainWindow.on('close', (event) => {
        if (forceExit) {
            // we want to exit and nothing in here may stop this
            return;
        }
        if (hasUnsavedChanges) {
            handleUnsavedChanges(event, () => {
                mainWindow.webContents.send('save-before-exit');
            });
        }
    });
};

const createBackend = async (
    token: ProgressToken,
    args: OpenArguments,
    settings: ChainnerSettings
) => {
    log.info(`chaiNNer Version: ${version}`);

    return setupBackend(
        token,
        settings.useSystemPython,
        settings.systemPythonLocation,
        getRootDir(),
        args.remoteBackend
    );
};

export const createMainWindow = async (args: OpenArguments, settings: ChainnerSettings) => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: settings.lastWindowSize.width,
        height: settings.lastWindowSize.height,
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

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url).catch(log.error);
        return { action: 'deny' };
    });

    const progressController = new ProgressController();
    addSplashScreen(progressController);

    try {
        registerEventHandlerPreSetup(mainWindow, args, settings);
        const backend = await createBackend(
            SubProgress.slice(progressController, 0, 0.5),
            args,
            settings
        );
        registerEventHandlerPostSetup(mainWindow, backend);

        const sse = new EventSource(`${backend.url}/setup-sse`, {
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
                    statusProgress: data.statusProgress ?? undefined,
                });
            }
        });

        let opened = false;
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

            if (!opened) {
                mainWindow.show();
                if (settings.lastWindowSize.maximized) {
                    mainWindow.maximize();
                }
                opened = true;
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
