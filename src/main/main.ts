import { app } from 'electron';
import log from 'electron-log';
import { readdirSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import './i18n';
import { createGuiApp } from './gui/create';
import { settingStorage } from './setting-storage';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line global-require
if (require('electron-squirrel-startup')) {
    app.quit();
}

const disableHardwareAcceleration = settingStorage.getItem('disable-hw-accel') === 'true';
if (disableHardwareAcceleration) {
    app.disableHardwareAcceleration();
}

// log.transports.file.resolvePath = () => path.join(app.getAppPath(), 'logs/main.log');
log.transports.file.resolvePath = (variables) =>
    path.join(variables.electronDefaultDir!, variables.fileName!);
log.transports.file.level = 'info';

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

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

createGuiApp();
