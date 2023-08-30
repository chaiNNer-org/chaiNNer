import { app } from 'electron';
import electronLog from 'electron-log';
import { readdirSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import './i18n';
import { LEVEL_NAME, log } from '../common/log';
import { parseArgs } from './arguments';
import { createCli } from './cli/create';
import { runChainInCli } from './cli/run';
import { createGuiApp } from './gui/create';
import { getLogsFolder, getRootDirSync } from './platform';

const startApp = () => {
    const args = parseArgs(process.argv.slice(app.isPackaged ? 1 : 2));

    electronLog.transports.file.resolvePath = (variables) =>
        path.join(getLogsFolder(), variables.fileName!);
    electronLog.transports.file.level = 'info';
    electronLog.transports.console.level = 'debug';

    log.addTransport({
        log: ({ level, message, additional }) => {
            electronLog[LEVEL_NAME[level]](message, ...additional);
        },
    });

    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

    app.setPath('userData', getRootDirSync());

    // On macOS, we need to store the file-path when chaiNNer got started via a double
    // click on a .chn file. This listener gets remove later on.
    app.on('open-file', (event, filePath) => {
        event.preventDefault();
        globalThis.startupFile = filePath;
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

    if (args.command === 'open') {
        createGuiApp(args);
    } else {
        createCli(() => runChainInCli(args));
    }
};

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// eslint-disable-next-line global-require
if (require('electron-squirrel-startup')) {
    app.quit();
} else {
    startApp();
}
