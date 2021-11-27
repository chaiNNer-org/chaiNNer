import { execSync, spawn, spawnSync } from 'child_process';
import {
  app, BrowserWindow, dialog, ipcMain, Menu, shell,
} from 'electron';
import { readFile, writeFile } from 'fs/promises';
import hasbin from 'hasbin';
// import { readdir } from 'fs/promises';
import path from 'path';
import portastic from 'portastic';
import semver from 'semver';

import { graphics } from 'systeminformation';

let gpuInfo;

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

const isMac = process.platform === 'darwin';
let port = 8000;

const pythonKeys = {
  python: 'python',
  pip: 'pip',
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

const getValidPort = async (splash) => {
  const ports = await portastic.find({
    min: 8000,
    max: 8080,
  });
  if (!ports || ports.length === 0) {
    splash.hide();
    const messageBoxOptions = {
      type: 'error',
      title: 'No open port',
      message: 'This error should never happen, but if it does it means you are running a lot of servers on your computer that just happen to be in the port range I look for. Quit some of those and then this will work.',
    };
    dialog.showMessageBoxSync(messageBoxOptions);
    app.exit(1);
  }
  [port] = ports;
  ipcMain.on('get-port', (event) => {
    // eslint-disable-next-line no-param-reassign
    event.returnValue = port;
  });
};

const checkPythonEnv = async (splash) => {
  const hasPythonAndPip = hasbin.all.sync(['python', 'pip']);
  const hasPython3AndPip3 = await hasbin.all.sync(['python3', 'pip3']);
  if (!hasPythonAndPip && !hasPython3AndPip3) {
    splash.hide();
    const messageBoxOptions = {
      type: 'error',
      title: 'Python not installed',
      buttons: ['Get Python', 'Exit'],
      defaultId: 1,
      message: 'It seems like you do not have Python installed on your system. Please install Python (>= 3.7 && < 3.10) to use this application. You can get Python from https://www.python.org/downloads/',
    };
    const buttonResult = dialog.showMessageBoxSync(messageBoxOptions);
    if (buttonResult === 1) {
      app.exit(1);
    } else if (buttonResult === 0) {
      await shell.openExternal('https://www.python.org/downloads/');
    }
    app.exit(1);
  }

  if (hasPython3AndPip3) {
    pythonKeys.python = 'python3';
    pythonKeys.pip = 'pip3';
  }

  const { stdout } = spawnSync(pythonKeys.python, ['--version'], {
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  const { version: pythonVersion } = semver.coerce(stdout);
  const hasValidPythonVersion = semver.gt(pythonVersion, '3.7.0') && semver.lt(pythonVersion, '3.10.0');
  if (!hasValidPythonVersion) {
    splash.hide();
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
  pythonKeys.version = pythonVersion;
  ipcMain.on('get-python', (event) => {
    // eslint-disable-next-line no-param-reassign
    event.returnValue = pythonKeys;
  });
};

const checkPythonDeps = async (splash) => {
  try {
    let pipList = execSync(`${pythonKeys.pip} list`);
    pipList = String(pipList).split('\n').map((pkg) => pkg.replace(/\s+/g, ' ').split(' '));
    const hasSanic = pipList.some((pkg) => pkg[0] === 'sanic');
    const hasSanicCors = pipList.some((pkg) => pkg[0] === 'Sanic-Cors');
    if (!hasSanic || !hasSanicCors) {
      splash.webContents.send('installing-deps');
      execSync(`${pythonKeys.pip} install sanic Sanic-Cors`);
    }
  } catch (error) {
    console.error(error);
  }
};

const spawnBackend = async () => {
  const backendPath = app.isPackaged ? path.join(process.resourcesPath, 'backend', 'run.py') : '../backend/run.py';
  const backend = spawn(pythonKeys.python, [backendPath, port], { stdio: 'inherit', stdout: 'inherit' });
  ipcMain.handle('kill-backend', () => {
    backend.kill();
  });
};

const doSplashScreenChecks = async (mainWindow) => new Promise((resolve) => {
  const splash = new BrowserWindow({
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

  const sleep = (ms) => new Promise((r) => {
    setTimeout(r, ms);
  });

  // Send events to splash screen renderer as they happen
  // Added some sleep functions so I can see that this is doing what I want it to
  // TODO: Remove the sleeps (or maybe not, since it feels more like something is happening here)
  splash.webContents.once('dom-ready', async () => {
    splash.webContents.send('checking-port');
    await getValidPort(splash);
    // await sleep(1000);

    splash.webContents.send('checking-python');
    await checkPythonEnv(splash);
    // await sleep(1000);

    splash.webContents.send('checking-deps');
    await checkPythonDeps(splash);
    // await sleep(1000);

    splash.webContents.send('spawning-backend');
    await spawnBackend();
    // await sleep(2000);

    splash.webContents.send('splash-finish');

    // await sleep(1000);
    resolve();
  });

  ipcMain.once('backend-ready', () => {
    splash.destroy();
    mainWindow.show();
  });
});

const createWindow = async () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#2D3748',
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

  await doSplashScreenChecks(mainWindow);

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
      await mainWindow.webContents.send('file-open', parsed, filepath);
    } catch (error) {
      console.error(error);
      // show error dialog idk
    }
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
