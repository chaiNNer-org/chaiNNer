import { app, BrowserWindow } from 'electron';
import path from 'path';

const { exec, execFile } = require('child_process');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = () => {
  const backend = path.join(process.cwd(), '../backend/dist/run.exe');

  execFile(
    backend,
    {
      windowsHide: true,
    },
    (err, stdout, stderr) => {
      if (err) {
        console.error(err);
      }
      if (stdout) {
        console.error(stdout);
      }
      if (stderr) {
        console.error(stderr);
      }
    },
  );

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    backgroundColor: '#263238',
    webPreferences: {
      // turn off webSecurity when in dev mode
      // webSecurity: false,
      // allowEval: false,
      nodeIntegration: true,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
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
    exec('taskkill /f /t /im app.exe', (err, stdout, stderr) => {
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
