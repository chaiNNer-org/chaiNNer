/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { ChildProcessWithoutNullStreams, exec as _exec, spawn } from 'child_process';
import {
    app,
    BrowserWindow,
    dialog,
    Menu,
    MenuItemConstructorOptions,
    nativeTheme,
    shell,
} from 'electron';
import log from 'electron-log';
import { readdirSync, rmSync } from 'fs';
import https from 'https';
import { LocalStorage } from 'node-localstorage';
import os from 'os';
import path from 'path';
import portfinder from 'portfinder';
import semver from 'semver';
import { graphics, Systeminformation } from 'systeminformation';
import util from 'util';
import { PythonKeys } from './common-types';
import { getNvidiaSmi } from './helpers/nvidiaSmi';
import { BrowserWindowWithSafeIpc, ipcMain } from './helpers/safeIpc';
import { SaveFile } from './helpers/SaveFile';
import { checkFileExists } from './helpers/util';
import { downloadPython, extractPython, installSanic } from './setupIntegratedPython';

const exec = util.promisify(_exec);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line global-require
if (require('electron-squirrel-startup')) {
    app.quit();
}

const localStorageLocation = path.join(app.getPath('userData'), 'settings');
ipcMain.handle('get-localstorage-location', () => localStorageLocation);
const localStorage = new LocalStorage(localStorageLocation);

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
                        title: `Error report for ${String(versions?.app)}`,
                        body: `Error:\n\`\`\`${String(error.stack)}\n\`\`\`\nOS: ${String(
                            versions?.os
                        )}`,
                    });
                    return;
                }

                if (result.response === 2) {
                    app.quit();
                }
            });
    },
});

let gpuInfo: Systeminformation.GraphicsData | undefined;

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const isMac = process.platform === 'darwin';

const pythonKeys: { python: string; version?: string } = {
    python: 'python',
};

// Check for update
if (app.isPackaged) {
    const options = {
        hostname: 'api.github.com',
        path: '/repos/joeyballentine/chaiNNer/releases',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'chaiNNer',
        },
    };
    const req = https.request(options, (res) => {
        let response = '';

        res.on('data', (data) => {
            response += String(data);
        });

        res.on('close', async () => {
            try {
                const releases = JSON.parse(response) as { tag_name: string; html_url: string }[];
                const gtVersions = releases.filter((v) =>
                    semver.gt(semver.coerce(v.tag_name)!, app.getVersion())
                );
                if (gtVersions.length > 0) {
                    const latestVersion = gtVersions.reduce((greatest, curr) =>
                        semver.gt(curr.tag_name, greatest.tag_name) ? curr : greatest
                    );
                    const releaseUrl = latestVersion.html_url;
                    const latestVersionNum = semver.coerce(latestVersion.tag_name)!;
                    const buttonResult = dialog.showMessageBoxSync(
                        BrowserWindow.getFocusedWindow()!,
                        {
                            type: 'info',
                            title: 'An update is available for chaiNNer!',
                            message: `Version ${latestVersionNum.version} is available for download from GitHub.`,
                            buttons: [`Get version ${latestVersionNum.version}`, 'Ok'],
                            defaultId: 1,
                        }
                    );
                    if (buttonResult === 0) {
                        await shell.openExternal(releaseUrl);
                        app.exit();
                    }
                }
            } catch (error) {
                log.error(error);
            }
        });
    });

    req.on('error', (error) => {
        log.error(error);
    });

    req.end();
}

if (app.isPackaged) {
    // workaround for missing executable argument)
    process.argv.unshift('');
}
const parameters = process.argv.slice(2);

let splash: BrowserWindowWithSafeIpc;
let mainWindow: BrowserWindowWithSafeIpc;

const registerEventHandlers = () => {
    ipcMain.handle('dir-select', (event, dirPath) =>
        dialog.showOpenDialog({
            defaultPath: dirPath,
            properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
        })
    );

    ipcMain.handle('file-select', (event, filters, allowMultiple = false, dirPath = undefined) =>
        dialog.showOpenDialog({
            filters,
            defaultPath: dirPath,
            properties: allowMultiple ? ['openFile', 'multiSelections'] : ['openFile'],
        })
    );

    ipcMain.handle('file-save-as-json', async (event, saveData, lastFilePath) => {
        try {
            const { canceled, filePath } = await dialog.showSaveDialog({
                title: 'Save Chain File',
                filters: [{ name: 'Chain File', extensions: ['chn'] }],
                defaultPath: lastFilePath,
            });
            if (!canceled && filePath) {
                await SaveFile.write(filePath, saveData, app.getVersion());
            }
            return filePath;
        } catch (error) {
            log.error(error);
            // TODO: Find a solution to this mess
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            return (error as any).message as never;
            // show error dialog idk
        }
    });

    ipcMain.handle('file-save-json', async (event, saveData, savePath) => {
        try {
            await SaveFile.write(savePath, saveData, app.getVersion());
        } catch (error) {
            log.error(error);
            // show error dialog idk
        }
    });

    ipcMain.handle('quit-application', () => {
        app.exit();
    });

    // ipcMain.handle('relaunch-application', async () => {
    //   app.relaunch();
    //   app.exit();
    // });

    ipcMain.handle('get-gpu-info', async () => {
        if (!gpuInfo) {
            gpuInfo = await graphics();
        }
        return gpuInfo;
    });

    ipcMain.handle('get-app-version', () => app.getVersion());

    ipcMain.handle('show-warning-message-box', async (event, title, message) => {
        dialog.showMessageBoxSync(BrowserWindow.getFocusedWindow()!, {
            type: 'warning',
            title,
            message,
        });
        return Promise.resolve();
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
        dialog.showMessageBoxSync(messageBoxOptions);
        app.exit(1);
    }
    log.info(`Port found: ${port}`);
    ipcMain.handle('get-port', () => {
        if (process.argv[2] && process.argv[2] === '--no-backend') {
            return 8000;
        }
        return port;
    });
    return port;
};

const getPythonVersion = async (pythonBin: string) => {
    try {
        const { stdout } = await exec(`${pythonBin} --version`);
        log.info(`Python version (raw): ${stdout}`);

        const { version } = semver.coerce(stdout)!;
        log.info(`Python version (semver): ${version}`);
        return version;
    } catch (error) {
        return null;
    }
};

const checkPythonVersion = (version: string) => semver.gte(version, '3.7.0');

const checkPythonEnv = async (splashWindow: BrowserWindowWithSafeIpc) => {
    log.info('Attempting to check Python env...');

    const localStorageVars = (await BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(
        '({...localStorage});'
    )) as Record<string, string>;
    const useSystemPython =
        localStorageVars['use-system-python'] === 'true' ||
        localStorage.getItem('use-system-python') === 'true';

    // User is using system python
    if (useSystemPython) {
        const pythonVersion = await getPythonVersion('python');
        const python3Version = await getPythonVersion('python3');
        let validPythonVersion;
        let pythonBin;

        if (pythonVersion && checkPythonVersion(pythonVersion)) {
            validPythonVersion = pythonVersion;
            pythonBin = 'python';
        } else if (python3Version && checkPythonVersion(python3Version)) {
            validPythonVersion = python3Version;
            pythonBin = 'python3';
        }

        log.info(`Final Python binary: ${String(pythonBin)}`);

        if (!pythonBin) {
            log.warn('Python binary not found');
            splashWindow.hide();
            const messageBoxOptions = {
                type: 'error',
                title: 'Python not installed',
                buttons: ['Get Python', 'Exit'],
                defaultId: 1,
                message:
                    'It seems like you do not have a valid version of Python installed on your system. Please install Python (>= 3.7) to use this application. You can get Python from https://www.python.org/downloads/. Be sure to select the add to PATH option.',
            };
            const buttonResult = dialog.showMessageBoxSync(messageBoxOptions);
            if (buttonResult === 1) {
                app.exit(1);
            } else if (buttonResult === 0) {
                await shell.openExternal('https://www.python.org/downloads/');
            }
            app.exit(1);
        }

        if (pythonBin) {
            pythonKeys.python = pythonBin;
            pythonKeys.version = validPythonVersion;
            log.info({ pythonKeys });
        }

        if (!validPythonVersion) {
            splashWindow.hide();
            const messageBoxOptions = {
                type: 'error',
                title: 'Python version invalid',
                buttons: ['Get Python', 'Exit'],
                defaultId: 1,
                message:
                    'It seems like your installed Python version does not meet the requirement (>=3.7). Please install a Python version at or above 3.7 to use this application. You can get Python from https://www.python.org/downloads/',
            };
            const buttonResult = dialog.showMessageBoxSync(messageBoxOptions);
            if (buttonResult === 1) {
                app.exit(1);
            } else if (buttonResult === 0) {
                await shell.openExternal('https://www.python.org/downloads/');
            }
            app.exit(1);
        }

        ipcMain.handle('get-python', () => pythonKeys as PythonKeys);
        // User is using bundled python
    } else {
        const integratedPythonFolderPath = path.join(app.getPath('userData'), '/python');

        const platform = os.platform();
        let pythonPath;
        switch (platform) {
            case 'win32':
                pythonPath = path.resolve(
                    path.join(integratedPythonFolderPath, '/python/python.exe')
                );
                break;
            case 'linux':
                pythonPath = path.resolve(
                    path.join(integratedPythonFolderPath, '/python/bin/python3.9')
                );
                break;
            case 'darwin':
                pythonPath = path.resolve(
                    path.join(integratedPythonFolderPath, '/python/bin/python3.9')
                );
                break;
            default:
                throw new Error(`Platform ${platform} not supported`);
        }

        const pythonBinExists = await checkFileExists(pythonPath);

        if (!pythonBinExists) {
            log.info('Python not downloaded');
            try {
                const onProgress = (percentage: number | string) => {
                    splash.webContents.send('progress', Number(percentage));
                };
                splash.webContents.send('downloading-python');
                onProgress(0);
                log.info('Downloading standalone python...');
                await downloadPython(integratedPythonFolderPath, onProgress);
                log.info('Done downloading standalone python.');
                splash.webContents.send('extracting-python');
                onProgress(0);
                log.info('Extracting standalone python...');
                await extractPython(integratedPythonFolderPath, pythonPath, onProgress);
                log.info('Done extracting standalone python.');
                splash.webContents.send('installing-main-deps');
                onProgress(0);
                log.info('Installing required deps...');
                await installSanic(pythonPath, onProgress);
                log.info('Done installing required deps...');
            } catch (error) {
                log.error(error);
            }
        }

        let pythonVersion = await getPythonVersion(pythonPath);
        if (!pythonVersion) {
            // TODO: Find a solution for this hack
            pythonVersion = 'unknown';
        }
        pythonKeys.python = pythonPath;
        pythonKeys.version = pythonVersion;
        log.info({ pythonKeys });

        ipcMain.handle('get-python', () => pythonKeys as PythonKeys);
    }
};

const checkPythonDeps = async (splashWindow: BrowserWindowWithSafeIpc) => {
    log.info('Attempting to check Python deps...');
    try {
        const { stdout: pipList } = await exec(`${pythonKeys.python} -m pip list`);
        const list = String(pipList)
            .split('\n')
            .map((pkg) => pkg.replace(/\s+/g, ' ').split(' '));
        const hasSanic = list.some((pkg) => pkg[0] === 'sanic');
        const hasSanicCors = list.some((pkg) => pkg[0] === 'Sanic-Cors');
        if (!hasSanic || !hasSanicCors) {
            log.info('Sanic not found. Installing sanic...');
            splashWindow.webContents.send('installing-deps');
            await exec(`${pythonKeys.python} -m pip install sanic==21.9.3 Sanic-Cors==1.0.1`);
        }
    } catch (error) {
        log.error(error);
    }
};

const checkNvidiaSmi = async () => {
    const registerEmptyGpuEvents = () => {
        ipcMain.handle('get-has-nvidia', () => false);
        ipcMain.handle('get-gpu-name', () => null);
        ipcMain.handle('get-vram-usage', () => null);
    };

    const registerNvidiaSmiEvents = async (nvidiaSmi: string) => {
        const [nvidiaGpu] = (
            await exec(
                `${nvidiaSmi} --query-gpu=name --format=csv,noheader,nounits ${
                    process.platform === 'linux' ? '  2>/dev/null' : ''
                }`
            )
        ).stdout.split('\n');
        ipcMain.handle('get-has-nvidia', () => true);
        ipcMain.handle('get-gpu-name', () => nvidiaGpu.trim());

        let vramChecker: ChildProcessWithoutNullStreams | undefined;
        let lastVRam: number | null = null;
        ipcMain.handle('get-vram-usage', () => {
            if (!vramChecker) {
                const delay = 1000;
                vramChecker = spawn(
                    nvidiaSmi,
                    `-lms ${delay} --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,utilization.memory --format=csv,noheader,nounits`.split(
                        ' '
                    )
                );

                vramChecker.stdout.on('data', (data) => {
                    const [, vramTotal, vramUsed] = String(data)
                        .split('\n')[0]
                        .split(/\s*,\s*/, 4);
                    console.log(String(data));

                    const usage = (Number(vramUsed) / Number(vramTotal)) * 100;
                    if (Number.isFinite(usage)) {
                        lastVRam = usage;
                    }
                });
            }

            return lastVRam;
        });
    };

    // Try using nvidia-smi from path
    let nvidiaSmi: string | undefined;
    try {
        if (os.platform() === 'win32') {
            const { stdout: nvidiaSmiTest } = await exec('where nvidia-smi');
            if (nvidiaSmiTest) {
                nvidiaSmi = 'nvidia-smi';
            }
        } else {
            const { stdout: nvidiaSmiTest } = await exec('which nvidia-smi');
            if (nvidiaSmiTest) {
                nvidiaSmi = 'nvidia-smi';
            }
        }
    } catch (_) {
        log.warn('nvidia-smi binary could not be located, attempting to run directly...');
        try {
            const { stdout: nvidiaSmiTest } = await exec('nvidia-smi');
            if (nvidiaSmiTest) {
                nvidiaSmi = 'nvidia-smi';
            }
        } catch (__) {
            log.warn('nvidia-smi failed to run.');
        }
    }

    // If nvidia-smi not in path, it might still exist on windows
    if (!nvidiaSmi) {
        if (os.platform() === 'win32') {
            log.info('Checking manually for nvidia-smi...');
            // Check an easy command to see what the name of the gpu is
            try {
                const { stdout } = await exec('wmic path win32_VideoController get name');
                const checks = ['geforce', 'nvidia', 'gtx', 'rtx', 'quadro'];
                if (checks.some((keyword) => stdout.toLowerCase().includes(keyword))) {
                    // Find the path to nvidia-smi
                    nvidiaSmi = await getNvidiaSmi();
                }
            } catch (_) {
                log.warn('Error occurred while checking for nvidia-smi');
            }
        }
    }

    if (nvidiaSmi) {
        ipcMain.handle('get-smi', () => nvidiaSmi);
        await registerNvidiaSmiEvents(nvidiaSmi);
    } else {
        registerEmptyGpuEvents();
    }
};

const spawnBackend = (port: number) => {
    if (process.argv[2] && process.argv[2] === '--no-backend') {
        return;
    }
    log.info('Attempting to spawn backend...');
    try {
        const backendPath = app.isPackaged
            ? path.join(process.resourcesPath, 'backend', 'run.py')
            : './backend/run.py';
        const backend = spawn(pythonKeys.python, [backendPath, String(port)]);
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
                spawnBackend(port);
            } catch (error) {
                log.error('Error restarting backend.', error);
            }
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
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
            }
        });
        log.info('Successfully spawned backend.');
    } catch (error) {
        log.error('Error spawning backend.');
    }
};

const doSplashScreenChecks = async () =>
    new Promise<void>((resolve) => {
        splash = new BrowserWindow({
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
        splash.loadURL(SPLASH_SCREEN_WEBPACK_ENTRY);

        splash.once('ready-to-show', () => {
            splash.show();
            // splash.webContents.openDevTools();
        });

        splash.on('close', () => {
            if (mainWindow) {
                mainWindow.destroy();
            }
        });

        // Look, I just wanna see the cool animation
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

        // Send events to splash screen renderer as they happen
        // Added some sleep functions so I can see that this is doing what I want it to
        // TODO: Remove the sleeps (or maybe not, since it feels more like something is happening here)
        splash.webContents.once('dom-ready', async () => {
            splash.webContents.send('checking-port');
            const port = await getValidPort(splash);
            await sleep(250);

            splash.webContents.send('checking-python');
            await checkPythonEnv(splash);
            await sleep(250);

            splash.webContents.send('checking-deps');
            await checkPythonDeps(splash);
            await checkNvidiaSmi();
            await sleep(250);

            splash.webContents.send('spawning-backend');
            spawnBackend(port);

            registerEventHandlers();

            splash.webContents.send('splash-finish');
            await sleep(250);

            resolve();
        });

        ipcMain.once('backend-ready', async () => {
            splash.webContents.send('finish-loading');
            splash.on('close', () => {});
            await sleep(500);
            splash.destroy();
            mainWindow.show();
        });
    });

const createWindow = async () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
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

    const menu = Menu.buildFromTemplate([
        ...(isMac ? [{ role: 'appMenu' }] : []),
        {
            label: 'File',
            submenu: [
                {
                    label: 'New',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow.webContents.send('file-new');
                    },
                },
                {
                    label: 'Open',
                    accelerator: 'CmdOrCtrl+O',
                    click: async () => {
                        const {
                            canceled,
                            filePaths: [filepath],
                        } = await dialog.showOpenDialog({
                            title: 'Open Chain File',
                            filters: [{ name: 'Chain', extensions: ['chn'] }],
                            properties: ['openFile'],
                        });
                        try {
                            if (!canceled) {
                                const saveData = await SaveFile.read(filepath);
                                mainWindow.webContents.send('file-open', saveData, filepath);
                            }
                        } catch (error) {
                            log.error(error);
                            // show error dialog idk
                        }
                    },
                },
                { type: 'separator' },
                {
                    label: 'Save',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        mainWindow.webContents.send('file-save');
                    },
                },
                {
                    label: 'Save As',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => {
                        mainWindow.webContents.send('file-save-as');
                    },
                },
                { type: 'separator' },
                isMac ? { role: 'close' } : { role: 'quit' },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                // { role: 'cut' },
                // { role: 'copy' },
                // { role: 'paste' },
                // ...(isMac ? [
                //   { role: 'delete' },
                //   { role: 'selectAll' },
                //   { type: 'separator' },
                //   {
                //     label: 'Speech',
                //     submenu: [
                //       { role: 'startSpeaking' },
                //       { role: 'stopSpeaking' },
                //     ],
                //   },
                // ] : [
                //   { role: 'delete' },
                //   { type: 'separator' },
                //   { role: 'selectAll' },
                // ]),
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
            ],
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(isMac
                    ? [
                          { type: 'separator' },
                          { role: 'front' },
                          { type: 'separator' },
                          { role: 'window' },
                      ]
                    : [{ role: 'close' }]),
            ],
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'View README',
                    click: async () => {
                        await shell.openExternal(
                            'https://github.com/joeyballentine/chaiNNer/blob/main/README.md'
                        );
                    },
                },
                {
                    label: 'Open logs folder',
                    click: async () => {
                        await shell.openPath(app.getPath('logs'));
                    },
                },
                {
                    label: 'Get ESRGAN models',
                    click: async () => {
                        await shell.openExternal('https://upscale.wiki/wiki/Model_Database');
                    },
                },
                {
                    label: 'Convert ONNX models to NCNN',
                    click: async () => {
                        await shell.openExternal('https://convertmodel.com/');
                    },
                },
            ],
        },
    ] as MenuItemConstructorOptions[]);
    Menu.setApplicationMenu(menu);

    await doSplashScreenChecks();

    // and load the index.html of the app.
    await mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

    // Open the DevTools.
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }

    // Opening file with chaiNNer
    if (parameters[0] && parameters[0] !== '--no-backend') {
        const filepath = parameters[0];
        try {
            const saveData = await SaveFile.read(filepath);
            ipcMain.handle('get-cli-open', () => saveData);
        } catch (error) {
            log.error(error);
            // show error dialog idk
        }
    } else {
        ipcMain.handle('get-cli-open', () => undefined);
    }
};

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
