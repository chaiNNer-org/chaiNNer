// Windows-only (un)install hooks

import { appendFileSync, existsSync, rmdirSync } from 'fs';
import path from 'path';
import { LEVEL_NAME, log } from '../common/log';
import { getLogsFolder, getRootDir } from './platform';

const setupLogging = () => {
    // setup logging
    // I don't trust electron-log to work properly in this context, so I'm
    // rolling my simple log file. It's going to be append-only.
    const logFile = path.join(getLogsFolder(), 'install.log');
    log.addTransport({
        log: ({ level, message, additional }) => {
            const timestamp = new Date().toISOString();
            const logLevel = LEVEL_NAME[level].toUpperCase();
            const fullMessage = [message, ...additional].map((a) => String(a)).join(' ');
            const line = `[${timestamp}] [${logLevel}] ${fullMessage}`;
            try {
                appendFileSync(logFile, `${line}\n`, 'utf8');
            } catch (error) {
                // eslint-disable-next-line no-console
                console.log(line);
            }
        },
    });
};

const onInstall = () => {
    // nothing right now
};

const onUninstall = () => {
    const foldersToCleanUp = [
        // chaiNNer folders
        'ffmpeg',
        'python',
        'settings',
        'settings_old',
        // don't delete the logs folder, it's important to us and doesn't take up much space
        // don't delete settings.json in case the user re-installs the app
    ];

    // delete all folders + their content
    for (const folder of foldersToCleanUp) {
        const p = path.join(getRootDir(), folder);
        log.info(`Deleting folder: ${p}`);
        try {
            if (existsSync(p)) {
                rmdirSync(p, { recursive: true });
            }
        } catch (error) {
            log.error(`Error deleting folder: ${String(error)}`);
        }
    }
};

/**
 * Handle creating/removing shortcuts on Windows when installing/uninstalling.
 *
 * If `true` is returned, the app should quit immediately.
 */
export const handleSquirrel = (): boolean => {
    if (process.platform !== 'win32') {
        return false;
    }

    // We use electron-squirrel-startup to process Squirrel events. It will do
    // the most important work for us, so we can focus on our custom logic.
    // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
    const isSquirrelCommand = Boolean(require('electron-squirrel-startup'));
    if (!isSquirrelCommand) {
        return false;
    }

    setupLogging();

    // https://github.com/electron-archive/grunt-electron-installer#handling-squirrel-events
    const squirrelCommand = process.argv[1];
    log.info(`Squirrel command: ${squirrelCommand}`);
    log.info(`Process execPath: ${process.execPath}`);

    try {
        switch (squirrelCommand) {
            case '--squirrel-install':
            case '--squirrel-updated':
                onInstall();
                break;
            case '--squirrel-uninstall':
                onUninstall();
                break;
            default:
                break;
        }
    } catch (e) {
        log.error(e);
    }

    return true;
};
