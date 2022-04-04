import { exec as _exec, spawn } from 'child_process';
import {
  app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell,
} from 'electron';
import log from 'electron-log';
import {
  access, readFile, writeFile,
} from 'fs/promises';
import https from 'https';
import os from 'os';
import path from 'path';
import portfinder from 'portfinder';
import semver from 'semver';
import { currentLoad, graphics, mem } from 'systeminformation';
import util from 'util';
import { getNvidiaSmi } from './helpers/nvidiaSmi';
import { downloadPython, extractPython, installSanic } from './setupIntegratedPython';

const exec = util.promisify(_exec);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

// log.transports.file.resolvePath = () => path.join(app.getAppPath(), 'logs/main.log');
// eslint-disable-next-line max-len
log.transports.file.resolvePath = (variables) => path.join(variables.electronDefaultDir, variables.fileName);
log.transports.file.level = 'info';

log.catchErrors({
  showDialog: false,
  onError(error, versions, submitIssue) {
    dialog.showMessageBox({
      title: 'An error occurred',
      message: error.message,
      detail: error.stack,
      type: 'error',
      buttons: ['Ignore', 'Report', 'Exit'],
    })
      .then((result) => {
        if (result.response === 1) {
          submitIssue('https://github.com/joeyballentine/chaiNNer/issues/new', {
            title: `Error report for ${versions.app}`,
            body: `Error:\n\`\`\`${error.stack}\n\`\`\`\nOS: ${versions.os}`,
          });
          return;
        }

        if (result.response === 2) {
          app.quit();
        }
      });
  },
});

let gpuInfo;

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const isMac = process.platform === 'darwin';

const pythonKeys = {
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
        const releases = JSON.parse(response);
        const gtVersions = releases.filter(
          (v) => semver.gt(semver.coerce(v.tag_name), app.getVersion()),
        );
        if (gtVersions.length > 0) {
          const sorted = gtVersions.sort((a, b) => semver.gt(a, b));
          const latestVersion = sorted[0];
          const releaseUrl = latestVersion.html_url;
          const latestVersionNum = semver.coerce(latestVersion.tag_name);
          const buttonResult = dialog.showMessageBoxSync(BrowserWindow.getFocusedWindow(), {
            type: 'info',
            title: 'An update is available for chaiNNer!',
            message: `Version ${latestVersionNum} is available for download from GitHub.`,
            buttons: [`Get version ${latestVersionNum}`, 'Ok'],
            defaultId: 1,
          });
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
  process.argv.unshift(null);
}
const parameters = process.argv.slice(2);

let splash;
let mainWindow;

const registerEventHandlers = () => {
  ipcMain.handle('dir-select', (event, dirPath) => dialog.showOpenDialog({
    defaultPath: dirPath,
    properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
  }));

  ipcMain.handle('file-select', (event, filters, allowMultiple = false, dirPath = undefined) => dialog.showOpenDialog({
    filters,
    defaultPath: dirPath,
    properties: ['openFile', allowMultiple && 'multiSelections'],
  }));

  ipcMain.handle('file-save-as-json', async (event, json, lastFilePath) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Chain File',
        filters: [{ name: 'Chain File', extensions: ['chn'] }],
        defaultPath: lastFilePath,
      });
      if (!canceled && filePath) {
        await writeFile(filePath, Buffer.from(json).toString('base64'), { encoding: 'binary' });
      }
      // eslint-disable-next-line no-param-reassign
      return filePath;
    } catch (error) {
      console.error(error);
      return error.message;
      // show error dialog idk
    }
  });

  ipcMain.handle('file-save-json', async (event, json, savePath) => {
    try {
      await writeFile(savePath, Buffer.from(json).toString('base64'), { encoding: 'binary' });
    } catch (error) {
      console.error(error);
      // show error dialog idk
    }
  });

  ipcMain.handle('quit-application', async () => {
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

  ipcMain.handle('get-live-sys-info', async () => {
    const gpu = await graphics();
    const cpu = await currentLoad();
    const ram = await mem();
    return {
      gpu, cpu, ram,
    };
  });

  ipcMain.handle('get-app-version', async () => app.getVersion());

  ipcMain.handle('show-warning-message-box', async (event, title, message) => {
    dialog.showMessageBoxSync(BrowserWindow.getFocusedWindow(), {
      type: 'warning',
      title,
      message,
    });
    return Promise.resolve();
  });
};

const getValidPort = async (splashWindow) => {
  log.info('Attempting to check for a port...');
  const port = await portfinder.getPortPromise();
  if (!port) {
    log.warn('An open port could not be found');
    splashWindow.hide();
    const messageBoxOptions = {
      type: 'error',
      title: 'No open port',
      message: 'This error should never happen, but if it does it means you are running a lot of servers on your computer that just happen to be in the port range I look for. Quit some of those and then this will work.',
    };
    dialog.showMessageBoxSync(messageBoxOptions);
    app.exit(1);
  }
  log.info(`Port found: ${port}`);
  ipcMain.handle('get-port', () => {
    if (process.argv[2] && process.argv[2] === '--no-backend') {
      // eslint-disable-next-line no-param-reassign
      return 8000;
    }
    // eslint-disable-next-line no-param-reassign
    return port;
  });
  return port;
};

const getPythonVersion = async (pythonBin) => {
  try {
    const { stdout } = await exec(`${pythonBin} --version`);
    log.info(`Python version (raw): ${stdout}`);
    const { version } = semver.coerce(stdout);
    log.info(`Python version (semver): ${version}`);
    return version;
  } catch (error) {
    return null;
  }
};

const checkPythonVersion = (version) => semver.gte(version, '3.7.0') && semver.lt(version, '3.10.0');

const checkPythonEnv = async (splashWindow) => {
  log.info('Attempting to check Python env...');

  const localStorageVars = await BrowserWindow.getAllWindows()[0].webContents.executeJavaScript('({...localStorage});');
  const useSystemPython = localStorageVars['use-system-python'];

  // User is using system python
  if (useSystemPython === 'true') {
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

    log.info(`Final Python binary: ${pythonBin}`);

    if (!pythonBin) {
      log.warn('Python binary not found');
      splashWindow.hide();
      const messageBoxOptions = {
        type: 'error',
        title: 'Python not installed',
        buttons: ['Get Python', 'Exit'],
        defaultId: 1,
        message: 'It seems like you do not have Python installed on your system. Please install Python (>= 3.7 && < 3.10) to use this application. You can get Python from https://www.python.org/downloads/. Be sure to select the add to PATH option.',
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
        message: 'It seems like your installed Python version does not meet the requirement (>=3.7 && < 3.10). Please install a Python version between 3.7 and 3.9 to use this application. You can get Python from https://www.python.org/downloads/',
      };
      const buttonResult = dialog.showMessageBoxSync(messageBoxOptions);
      if (buttonResult === 1) {
        app.exit(1);
      } else if (buttonResult === 0) {
        await shell.openExternal('https://www.python.org/downloads/');
      }
      app.exit(1);
    }

    ipcMain.handle('get-python', () => pythonKeys);
    // User is using bundled python
  } else {
    const integratedPythonFolderPath = path.join(app.getPath('userData'), '/python');

    const platform = os.platform();
    let pythonPath;
    switch (platform) {
      case 'win32':
        pythonPath = path.resolve(path.join(integratedPythonFolderPath, '/python/python.exe'));
        break;
      case 'linux':
        pythonPath = path.resolve(path.join(integratedPythonFolderPath, '/python/bin/python3.9'));
        break;
      case 'darwin':
        pythonPath = path.resolve(path.join(integratedPythonFolderPath, '/python/bin/python3.9'));
        break;
      default:
        break;
    }

    let pythonBinExists = true;
    try {
      await access(pythonPath);
    } catch (error) {
      pythonBinExists = false;
    }

    if (!pythonBinExists) {
      log.info('Python not downloaded');
      try {
      // eslint-disable-next-line no-unused-vars
        const onProgress = (percentage, _chunk = null, _remainingSize = null) => {
          splash.webContents.send('progress', percentage);
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

    const pythonVersion = await getPythonVersion(pythonPath);
    pythonKeys.python = pythonPath;
    pythonKeys.version = pythonVersion;
    log.info({ pythonKeys });

    ipcMain.handle('get-python', () => pythonKeys);
  }
};

const checkPythonDeps = async (splashWindow) => {
  log.info('Attempting to check Python deps...');
  try {
    let { stdout: pipList } = await exec(`${pythonKeys.python} -m pip list`);
    pipList = String(pipList).split('\n').map((pkg) => pkg.replace(/\s+/g, ' ').split(' '));
    const hasSanic = pipList.some((pkg) => pkg[0] === 'sanic');
    const hasSanicCors = pipList.some((pkg) => pkg[0] === 'Sanic-Cors');
    if (!hasSanic || !hasSanicCors) {
      log.info('Sanic not found. Installing sanic...');
      splashWindow.webContents.send('installing-deps');
      await exec(`${pythonKeys.python} -m pip install sanic==21.9.3 Sanic-Cors==1.0.1`);
    }
  } catch (error) {
    console.error(error);
  }
};

const checkNvidiaSmi = async () => {
  const registerEmptyGpuEvents = () => {
    ipcMain.handle('get-has-nvidia', () => false);
    ipcMain.handle('get-gpu-name', () => null);
    ipcMain.handle('setup-vram-checker-process', () => null);
    ipcMain.handle('get-vram-usage', () => null);
  };

  const registerNvidiaSmiEvents = async (nvidiaSmi) => {
    const [nvidiaGpu] = (await exec(`${nvidiaSmi} --query-gpu=name --format=csv,noheader,nounits ${process.platform === 'linux' ? '  2>/dev/null' : ''}`)).stdout.split('\n');
    ipcMain.handle('get-has-nvidia', () => true);
    ipcMain.handle('get-gpu-name', () => nvidiaGpu.trim());
    let vramChecker;
    ipcMain.handle('setup-vram-checker-process', (event, delay) => {
      if (!vramChecker) {
        vramChecker = spawn(nvidiaSmi, `-lms ${delay} --query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,utilization.memory --format=csv,noheader,nounits`.split(' '));
      }

      vramChecker.stdout.on('data', (data) => {
        ipcMain.removeHandler('get-vram-usage');
        ipcMain.handle('get-vram-usage', () => {
          const [, vramTotal, vramUsed] = String(data).split('\n')[0].split(', ');
          const usage = (Number(vramUsed) / Number(vramTotal)) * 100;
          return usage;
        });
      });
    });
  };

  // Try using nvidia-smi from path
  let nvidiaSmi = null;
  try {
    const { stdout: nvidiaSmiTest } = await exec('nvidia-smi');
    if (nvidiaSmiTest) {
      nvidiaSmi = 'nvidia-smi';
    }
  } catch (_) {
    // pass
  }

  // If nvidia-smi not in path, it might still exist on windows
  if (!nvidiaSmi) {
    if (os.platform() === 'win32') {
      // Check an easy command to see what the name of the gpu is
      try {
        const { stdout } = await exec('wmic path win32_VideoController get name');
        if (stdout.toLowerCase().includes('geforce') || stdout.toLowerCase().includes('nvidia')) {
        // Find the path to nvidia-smi
          nvidiaSmi = await getNvidiaSmi();
        }
      } catch (_) {
      // pass
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

const spawnBackend = async (port) => {
  if (process.argv[2] && process.argv[2] === '--no-backend') {
    return;
  }
  log.info('Attempting to spawn backend...');
  try {
    const backendPath = app.isPackaged ? path.join(process.resourcesPath, 'backend', 'run.py') : './backend/run.py';
    const backend = spawn(pythonKeys.python, [backendPath, port]);
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
      log.error(`Python subprocess encountered an unexpected error: ${error}`);
    });

    backend.on('exit', (code, signal) => {
      log.error(`Python subprocess exited with code ${code} and signal ${signal}`);
    });

    ipcMain.handle('relaunch-application', async () => {
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

    ipcMain.handle('restart-backend', async () => {
      log.info('Attempting to kill backend...');
      try {
        const success = backend.kill();
        if (success) {
          log.error('Successfully killed backend to restart it.');
        } else {
          log.error('Error killing backend.');
        }
        ipcMain.removeHandler('kill-backend');
        await spawnBackend(port);
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

const doSplashScreenChecks = async () => new Promise((resolve) => {
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
      nativeWindowOpen: true,
      nodeIntegration: true,
      contextIsolation: false,
    },
    // icon: `${__dirname}/public/icons/cross_platform/icon`,
    show: false,
  });
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
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    await spawnBackend(port);

    registerEventHandlers();

    splash.webContents.send('splash-finish');
    await sleep(250);

    resolve();
  });

  ipcMain.handle('backend-ready', () => {
    mainWindow.webContents.once('dom-ready', async () => {
      splash.webContents.send('finish-loading');
      splash.on('close', () => {});
      await sleep(500);
      splash.destroy();
      mainWindow.show();
      ipcMain.removeHandler('backend-ready');
    });
  });

  mainWindow.webContents.once('dom-ready', async () => {
    ipcMain.removeHandler('backend-ready');
    ipcMain.handle('backend-ready', async () => {
      splash.webContents.send('finish-loading');
      splash.on('close', () => {});
      await sleep(500);
      splash.destroy();
      mainWindow.show();
      ipcMain.removeHandler('backend-ready');
    });
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
      nativeWindowOpen: true,
    },
    // icon: `${__dirname}/public/icons/cross_platform/icon`,
    show: false,
  });

  const menu = Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          click: async () => {
            await mainWindow.webContents.send('file-new');
          },
        },
        {
          label: 'Open',
          click: async () => {
            const { canceled, filePaths: [filepath] } = await dialog.showOpenDialog({
              title: 'Open Chain File',
              filters: [{ name: 'Chain', extensions: ['chn'] }],
              properties: ['openFile'],
            });
            try {
              if (!canceled) {
                const fileContents = await readFile(filepath, { encoding: 'binary' });
                const buf = Buffer.from(fileContents, 'base64').toString('utf8');
                const parsed = JSON.parse(buf);
                await mainWindow.webContents.send('file-open', parsed, filepath);
              }
            } catch (error) {
              console.error(error);
              // show error dialog idk
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Save',
          click: async () => {
            mainWindow.webContents.send('file-save');
          },
        },
        {
          label: 'Save As',
          click: async () => {
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
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' },
        ] : [
          { role: 'close' },
        ]),
      ],
    },
    {
      role: 'Help',
      submenu: [
        {
          label: 'View README',
          click: async () => {
            await shell.openExternal('https://github.com/joeyballentine/chaiNNer/blob/main/README.md');
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
  ]);
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
      // TODO: extract to function
      const fileContents = await readFile(filepath, { encoding: 'binary' });
      const buf = Buffer.from(fileContents, 'base64').toString('utf8');
      const parsed = JSON.parse(buf);
      // await mainWindow.webContents.send('file-open', parsed, filepath);
      ipcMain.handle('get-cli-open', () => parsed);
    } catch (error) {
      console.error(error);
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
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('uncaughtException', (err) => {
  const messageBoxOptions = {
    type: 'error',
    title: 'Error in Main process',
    message: `Something failed: ${err}`,
  };
  dialog.showMessageBoxSync(messageBoxOptions);
  app.exit(1);
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
