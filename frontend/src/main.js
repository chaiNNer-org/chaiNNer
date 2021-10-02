import {
  app, BrowserWindow, ipcMain, dialog,
} from 'electron';
// import { readdir } from 'fs/promises';
// import path from 'path';

const { exec, spawn } = require('child_process');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = async () => {
  // This should make it platform independent since I don't know what extension it'll be
  // TODO: Figure out if it's always an exe
  // const backendRoot = path.join(process.cwd(), '../backend/run.dist/');
  // const files = await readdir(backendRoot);
  // const file = files.find((item) => item.split('.')[0] === 'run');
  // const backend = path.join(backendRoot, file);
  // console.log(backend);

  // execFile(
  //   backend,
  //   {
  //     windowsHide: true,
  //   },
  //   (err, stdout, stderr) => {
  //     if (err) {
  //       console.error(err);
  //     }
  //     if (stdout) {
  //       console.error(stdout);
  //     }
  //     if (stderr) {
  //       console.error(stderr);
  //     }
  //   },
  // );

  spawn('python', ['../backend/run.py']);

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#2D3748',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      nativeWindowOpen: true,
    },
    // show: false,
  });

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
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      nativeWindowOpen: true,
      nodeIntegration: true,
      contextIsolation: false,
    },
    show: false,
  });
  splash.loadURL(SPLASH_SCREEN_WEBPACK_ENTRY);

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  splash.once('ready-to-show', () => {
    splash.show();
  });

  ipcMain.once('backend-ready', () => {
    splash.destroy();
    mainWindow.show();
  });
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
    exec('taskkill /f /t /im run.exe', (err, stdout, stderr) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log(`stdout: ${stdout}`);
      console.log(`stderr: ${stderr}`);
    });
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
