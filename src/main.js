import { execSync, spawn } from 'child_process';
import {
  app, BrowserWindow, dialog, ipcMain, Menu, shell,
} from 'electron';
import log from 'electron-log';
import { readFile, writeFile } from 'fs/promises';
// import { readdir } from 'fs/promises';
import path from 'path';
import portastic from 'portastic';
import semver from 'semver';
import { currentLoad, graphics, mem } from 'systeminformation';
import { getNvidiaSmi } from './helpers/nvidiaSmi';

// log.transports.file.resolvePath = () => path.join(app.getAppPath(), 'logs/main.log');
// eslint-disable-next-line max-len
log.transports.file.resolvePath = (variables) => path.join(variables.electronDefaultDir, variables.fileName);
log.transports.file.level = 'info';

let gpuInfo;

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const isMac = process.platform === 'darwin';
let port = 8000;

const pythonKeys = {
  python: 'python',
};

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
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

  ipcMain.handle('file-select', (event, filters, allowMultiple = false) => dialog.showOpenDialog({
    filters,
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

  ipcMain.handle('relaunch-application', async () => {
    app.relaunch();
    app.exit();
  });

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
};

const getValidPort = async (splashWindow) => {
  log.info('Attempting to check for a port...');
  const ports = await portastic.find({
    min: 8000,
    max: 8080,
  });
  if (!ports || ports.length === 0) {
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
  [port] = ports;
  log.info(`Port found: ${port}`);
  ipcMain.on('get-port', (event) => {
    // eslint-disable-next-line no-param-reassign
    event.returnValue = port;
  });
};

const getPythonVersion = (pythonBin) => {
  try {
    const stdout = execSync(`${pythonBin} --version`).toString();
    log.info(`Python version (raw): ${stdout}`);
    const { version } = semver.coerce(stdout);
    log.info(`Python version (semver): ${version}`);
    return version;
  } catch (error) {
    return null;
  }
};

const checkPythonVersion = (version) => semver.gt(version, '3.7.0') && semver.lt(version, '3.10.0');

const checkPythonEnv = async (splashWindow) => {
  log.info('Attempting to check Python env...');

  const pythonVersion = getPythonVersion('python');
  const python3Version = getPythonVersion('python3');
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

  ipcMain.on('get-python', (event) => {
    // eslint-disable-next-line no-param-reassign
    event.returnValue = pythonKeys;
  });
};

const checkPythonDeps = async (splashWindow) => {
  log.info('Attempting to check Python deps...');
  try {
    let pipList = execSync(`${pythonKeys.python} -m pip list`);
    pipList = String(pipList).split('\n').map((pkg) => pkg.replace(/\s+/g, ' ').split(' '));
    const hasSanic = pipList.some((pkg) => pkg[0] === 'sanic');
    const hasSanicCors = pipList.some((pkg) => pkg[0] === 'Sanic-Cors');
    if (!hasSanic || !hasSanicCors) {
      log.info('Sanic not found. Installing sanic...');
      splashWindow.webContents.send('installing-deps');
      execSync(`${pythonKeys.python} -m pip install sanic Sanic-Cors`);
    }
  } catch (error) {
    console.error(error);
  }
};

const checkNvidiaSmi = async () => {
  const nvidiaSmi = getNvidiaSmi();
  ipcMain.handle('get-smi', () => nvidiaSmi);
  if (nvidiaSmi) {
    const [gpu] = execSync(`${nvidiaSmi} --query-gpu=name --format=csv,noheader,nounits ${process.platform === 'linux' ? '  2>/dev/null' : ''}`).toString().split('\n');
    ipcMain.handle('get-has-nvidia', () => true);
    ipcMain.handle('get-gpu-name', () => gpu.trim());
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
  } else {
    ipcMain.handle('get-has-nvidia', () => false);
    ipcMain.handle('get-gpu-name', () => null);
    ipcMain.handle('setup-vram-checker-process', () => null);
    ipcMain.handle('get-vram-usage', () => null);
  }
};

const spawnBackend = async () => {
  log.info('Attempting to spawn backend...');
  const backendPath = app.isPackaged ? path.join(process.resourcesPath, 'backend', 'run.py') : './backend/run.py';
  const backend = spawn(pythonKeys.python, [backendPath, port]);

  backend.stdout.on('data', (data) => {
    log.info(`Backend: ${String(data)}`);
  });

  backend.stderr.on('data', (data) => {
    log.error(`Backend: ${String(data)}`);
  });

  ipcMain.handle('kill-backend', () => {
    log.info('Attempting to kill backend...');
    backend.kill();
  });
};

const doSplashScreenChecks = async () => new Promise((resolve) => {
  splash = new BrowserWindow({
    width: 400,
    height: 400,
    frame: false,
    backgroundColor: '#2D3748',
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

  // Send events to splash screen renderer as they happen
  // Added some sleep functions so I can see that this is doing what I want it to
  // TODO: Remove the sleeps (or maybe not, since it feels more like something is happening here)
  splash.webContents.once('dom-ready', async () => {
    splash.webContents.send('checking-port');
    await getValidPort(splash);

    splash.webContents.send('checking-python');
    await checkPythonEnv(splash);

    splash.webContents.send('checking-deps');
    await checkPythonDeps(splash);
    await checkNvidiaSmi();

    splash.webContents.send('spawning-backend');
    await spawnBackend();

    registerEventHandlers();

    splash.webContents.send('splash-finish');

    resolve();
  });

  ipcMain.once('backend-ready', () => {
    splash.on('close', () => {});
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
            await shell.openExternal('https://github.com/JoeyBallentine/chaiNNer');
          },
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  await doSplashScreenChecks();

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  if (parameters[0]) {
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
