/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { BrowserWindow, app, dialog, nativeTheme, powerSaveBlocker, shell } from 'electron';
import log from 'electron-log';
import { readdirSync, rmSync } from 'fs';
import { LocalStorage } from 'node-localstorage';
import os from 'os';
import path from 'path';
import portfinder from 'portfinder';
import semver from 'semver';
import { PythonInfo, WindowSize } from '../common/common-types';
import { Dependency, getOptionalDependencies, requiredDependencies } from '../common/dependencies';
import { sanitizedEnv } from '../common/env';
import { runPipInstall, runPipList } from '../common/pip';
import { BrowserWindowWithSafeIpc, ipcMain } from '../common/safeIpc';
import { SaveFile, openSaveFile } from '../common/SaveFile';
import { lazy } from '../common/util';
import { getArguments } from './arguments';
import { registerDiscordRPC, toggleDiscordRPC, updateDiscordRPC } from './discordRPC';
import { MenuData, setMainMenu } from './menu';
import { createNvidiaSmiVRamChecker, getNvidiaGpuNames, getNvidiaSmi } from './nvidiaSmi';
import { getIntegratedPython } from './python/integratedPython';
import { getSystemPython } from './python/systemPython';
import { getGpuInfo } from './systemInfo';
import { hasUpdate } from './update';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line global-require
if (require('electron-squirrel-startup')) {
    app.quit();
}

const localStorageLocation = path.join(app.getPath('userData'), 'settings');
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
                    submitIssue!('https://github.com/joeyballentine/chaiNNer/issues/new', {
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
const checkUpdateOnStartup = localStorage.getItem('check-upd-on-strtup') === 'true';
if (app.isPackaged && checkUpdateOnStartup) {
    hasUpdate(app.getVersion())
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
                detail: `Currently installed: ${app.getVersion()}\n\nRelease notes:\n\n${changelogItems.join(
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
}

const ownsBackend = !getArguments().noBackend;
ipcMain.handle('owns-backend', () => ownsBackend);

const registerEventHandlers = (mainWindow: BrowserWindowWithSafeIpc) => {
    ipcMain.handle('dir-select', (event, dirPath) =>
        dialog.showOpenDialog(mainWindow, {
            defaultPath: dirPath,
            properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
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
                await SaveFile.write(filePath, saveData, app.getVersion());
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
            await SaveFile.write(savePath, saveData, app.getVersion());
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

    ipcMain.handle('get-app-version', () => app.getVersion());

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

    ipcMain.handle('toggle-discord-rpc', async (event, enabled) => {
        await toggleDiscordRPC(enabled);
    });

    ipcMain.handle('update-discord-rpc', async (event, config) => {
        await updateDiscordRPC(config);
    });
};

const getValidPort = async (splashWindow: BrowserWindowWithSafeIpc) => {
    log.info('Attempting to check for a port...');
    const port = await portfinder.getPortPromise();
    if (!port) {
        log.warn('An open port could not be found');
        splashWindow.hide();
        const messageBoxOptions = {
            type: 'error',
            title: 'No open port',
            message:
                'This error should never happen, but if it does it means you are running a lot of servers on your computer that just happen to be in the port range I look for. Quit some of those and then this will work.',
        };
        await dialog.showMessageBox(messageBoxOptions);
        app.exit(1);
    }
    log.info(`Port found: ${port}`);
    ipcMain.handle('get-port', () => {
        if (getArguments().noBackend) {
            return 8000;
        }
        return port;
    });
    return port;
};

const checkPythonEnv = async (splashWindow: BrowserWindowWithSafeIpc) => {
    log.info('Attempting to check Python env...');

    let pythonInfo: PythonInfo;

    const useSystemPython = localStorage.getItem('use-system-python') === 'true';

    if (useSystemPython) {
        try {
            pythonInfo = await getSystemPython();
        } catch (error) {
            log.error(error);

            splashWindow.hide();
            const messageBoxOptions = {
                type: 'error',
                title: 'Python not installed or invalid version',
                buttons: ['Get Python', 'Exit'],
                defaultId: 1,
                message:
                    'It seems like you do not have a valid version of Python installed on your system. Please install Python (>= 3.7) to use this application. You can get Python from https://www.python.org/downloads/. Be sure to select the add to PATH option.',
            };
            const buttonResult = await dialog.showMessageBox(messageBoxOptions);
            if (buttonResult.response === 0) {
                await shell.openExternal('https://www.python.org/downloads/');
            }
            app.exit(1);
            throw new Error();
        }
    } else {
        // User is using bundled python
        const integratedPythonFolderPath = path.join(app.getPath('userData'), '/python');

        try {
            let lastStage = '';
            pythonInfo = await getIntegratedPython(
                integratedPythonFolderPath,
                (percentage, stage) => {
                    if (stage !== lastStage) {
                        lastStage = stage;
                        splashWindow.webContents.send(`${stage}ing-python`);
                    }
                    splashWindow.webContents.send('progress', percentage);
                }
            );
        } catch (error) {
            log.error(error);

            splashWindow.hide();
            const messageBoxOptions = {
                type: 'error',
                title: 'Unable to install integrated Python',
                buttons: ['Exit'],
                message:
                    `Chainner was unable to install its integrated Python environment.` +
                    ` Please ensure that your computer is connected to the internet and that chainner has access to the network.`,
            };
            await dialog.showMessageBox(messageBoxOptions);
            app.exit(1);
            throw new Error();
        }
    }

    log.info(`Final Python binary: ${pythonInfo.python}`);
    log.info(pythonInfo);

    ipcMain.handle('get-python', () => pythonInfo);
    return pythonInfo;
};

const checkSemverGt = (v1: string, v2: string) => {
    try {
        return semver.gt(semver.coerce(v1)!.version, semver.coerce(v2)!.version);
    } catch (error) {
        log.error(error);
        return false;
    }
};

const checkPythonDeps = async (
    splashWindow: BrowserWindowWithSafeIpc,
    pythonInfo: PythonInfo,
    hasNvidia: boolean
) => {
    log.info('Attempting to check Python deps...');
    try {
        const pipList = await runPipList(pythonInfo);
        const installedPackages = new Set(Object.keys(pipList));

        const requiredPackages = requiredDependencies.flatMap((dep) => dep.packages);
        const optionalPackages = getOptionalDependencies(hasNvidia).flatMap((dep) => dep.packages);

        // CASE 1: A package isn't installed
        const missingRequiredPackages = requiredPackages.filter(
            (packageInfo) => !installedPackages.has(packageInfo.packageName)
        );

        // CASE 2: A required package is installed but not the latest version
        const outOfDateRequiredPackages = requiredPackages.filter((packageInfo) => {
            const installedVersion = pipList[packageInfo.packageName];
            if (!installedVersion) {
                return false;
            }
            return checkSemverGt(packageInfo.version, installedVersion);
        });

        // CASE 3: An optional package is installed, set to auto update, and is not the latest version
        const outOfDateOptionalPackages = optionalPackages.filter((packageInfo) => {
            const installedVersion = pipList[packageInfo.packageName];
            if (!installedVersion) {
                return false;
            }
            return packageInfo.autoUpdate && checkSemverGt(packageInfo.version, installedVersion);
        });

        const allPackagesThatNeedToBeInstalled = [
            ...missingRequiredPackages,
            ...outOfDateRequiredPackages,
            ...outOfDateOptionalPackages,
        ];

        if (allPackagesThatNeedToBeInstalled.length > 0) {
            const isInstallingRequired = missingRequiredPackages.length > 0;
            const isUpdating =
                outOfDateRequiredPackages.length > 0 || outOfDateOptionalPackages.length > 0;

            splashWindow.webContents.send('installing-deps', isUpdating && !isInstallingRequired);
            // Try to update/install deps
            log.info('Installing/Updating dependencies...');
            await runPipInstall(pythonInfo, [
                {
                    name: 'All Packages That Need To Be Installed',
                    packages: allPackagesThatNeedToBeInstalled,
                },
            ] as Dependency[]);
        }
    } catch (error) {
        log.error(error);
    }
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

const spawnBackend = (port: number, pythonInfo: PythonInfo) => {
    if (getArguments().noBackend) {
        return;
    }

    log.info('Attempting to spawn backend...');
    try {
        const backendPath = app.isPackaged
            ? path.join(process.resourcesPath, 'src', 'run.py')
            : './backend/src/run.py';
        const backend = spawn(pythonInfo.python, [backendPath, String(port)], {
            env: sanitizedEnv,
        });
        backend.stdout.on('data', (data) => {
            const dataString = String(data);
            // Remove unneeded timestamp
            const fixedData = dataString.split('] ').slice(1).join('] ');
            log.info(`Backend: ${fixedData}`);
        });

        backend.stderr.on('data', (data) => {
            log.error(`Backend: ${String(data)}`);
        });

        backend.on('error', (error) => {
            log.error(`Python subprocess encountered an unexpected error: ${String(error)}`);
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

        backend.on('exit', (code, signal) => {
            log.error(
                `Python subprocess exited with code ${String(code)} and signal ${String(signal)}`
            );
        });

        ipcMain.handle('relaunch-application', () => {
            log.info('Attempting to kill backend...');
            try {
                const success = backend.kill();
                if (success) {
                    log.error('Successfully killed backend.');
                } else {
                    log.error('Error killing backend.');
                }
            } catch (error) {
                log.error('Error killing backend.', error);
            }
            app.relaunch();
            app.exit();
        });

        ipcMain.handle('kill-backend', () => {
            log.info('Attempting to kill backend...');
            try {
                const success = backend.kill();
                if (success) {
                    log.error('Successfully killed backend.');
                } else {
                    log.error('Error killing backend.');
                }
            } catch (error) {
                log.error('Error killing backend.', error);
            }
        });

        ipcMain.handle('restart-backend', () => {
            log.info('Attempting to kill backend...');
            try {
                const success = backend.kill();
                if (success) {
                    log.error('Successfully killed backend to restart it.');
                } else {
                    log.error('Error killing backend.');
                }
                ipcMain.removeHandler('kill-backend');
                spawnBackend(port, pythonInfo);
            } catch (error) {
                log.error('Error restarting backend.', error);
            }
        });

        app.on('before-quit', () => {
            log.info('Attempting to kill backend...');
            try {
                const success = backend.kill();
                if (success) {
                    log.error('Successfully killed backend.');
                } else {
                    log.error('Error killing backend.');
                }
            } catch (error) {
                log.error('Error killing backend.');
            }
        });

        log.info('Successfully spawned backend.');
    } catch (error) {
        log.error('Error spawning backend.');
    }
};

const doSplashScreenChecks = async (mainWindow: BrowserWindowWithSafeIpc) =>
    new Promise<void>((resolve) => {
        const splash = new BrowserWindow({
            width: 400,
            height: 400,
            frame: false,
            // backgroundColor: '#2D3748',
            center: true,
            minWidth: 400,
            minHeight: 400,
            maxWidth: 400,
            maxHeight: 400,
            resizable: false,
            minimizable: true,
            maximizable: false,
            closable: false,
            alwaysOnTop: true,
            titleBarStyle: 'hidden',
            transparent: true,
            roundedCorners: true,
            webPreferences: {
                webSecurity: false,
                nodeIntegration: true,
                contextIsolation: false,
            },
            // icon: `${__dirname}/public/icons/cross_platform/icon`,
            show: false,
        }) as BrowserWindowWithSafeIpc;
        if (!splash.isDestroyed()) {
            try {
                splash.loadURL(SPLASH_SCREEN_WEBPACK_ENTRY);
            } catch (error) {
                log.error('Error loading splash window.', error);
            }
        }

        splash.once('ready-to-show', () => {
            splash.show();
            // splash.webContents.openDevTools();
        });

        splash.on('close', () => {
            mainWindow.destroy();
            resolve();
        });

        // Look, I just wanna see the cool animation
        const sleep = (ms: number) =>
            new Promise((r) => {
                setTimeout(r, ms);
            });

        // Send events to splash screen renderer as they happen
        // Added some sleep functions so I can see that this is doing what I want it to
        // TODO: Remove the sleeps (or maybe not, since it feels more like something is happening here)
        splash.webContents.once('dom-ready', async () => {
            splash.webContents.send('checking-port');
            const port = await getValidPort(splash);
            await sleep(250);

            splash.webContents.send('checking-python');
            const pythonInfo = await checkPythonEnv(splash);
            await sleep(250);

            splash.webContents.send('checking-deps');
            const hasNvidia = await nvidiaSmiPromise;
            await checkPythonDeps(splash, pythonInfo, hasNvidia);
            await sleep(250);

            splash.webContents.send('spawning-backend');
            spawnBackend(port, pythonInfo);

            registerEventHandlers(mainWindow);

            splash.webContents.send('splash-finish');
            await sleep(250);

            resolve();
        });

        ipcMain.once('backend-ready', async () => {
            if (localStorage.getItem('use-discord-rpc') === 'true') {
                await registerDiscordRPC();
                await updateDiscordRPC({});
            }
            splash.webContents.send('finish-loading');
            splash.on('close', () => {});
            await sleep(500);
            splash.destroy();
            mainWindow.show();
            if (lastWindowSize?.maximized) {
                mainWindow.maximize();
            }
        });
    });

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
        // icon: `${__dirname}/public/icons/cross_platform/icon`,
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

    await doSplashScreenChecks(mainWindow);

    // and load the index.html of the app.
    if (!mainWindow.isDestroyed()) {
        try {
            await mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
        } catch (error) {
            log.error('Error loading main window.', error);
        }
    }

    // Open the DevTools.
    if (!app.isPackaged && !mainWindow.isDestroyed()) {
        mainWindow.webContents.openDevTools();
    }

    let hasUnsavedChanges = false;
    ipcMain.on('update-has-unsaved-changes', (_, value) => {
        hasUnsavedChanges = value;
    });

    mainWindow.on('close', (event) => {
        if (hasUnsavedChanges) {
            const choice = dialog.showMessageBoxSync(mainWindow, {
                type: 'question',
                buttons: ['Yes', 'No'],
                defaultId: 1,
                title: 'Discard unsaved changes?',
                message:
                    'The current chain has some unsaved changes. Do you really want to quit without saving?',
            });
            if (choice === 1) event.preventDefault();
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
