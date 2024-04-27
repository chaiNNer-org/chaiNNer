import { FSWatcher } from 'chokidar';
import { log } from '../common/log';
import { BrowserWindowWithSafeIpc } from './safeIpc';

type EventType = 'add' | 'change' | 'unlink';

// Keep track of all the files being watched and how many times they are being watched
const watchedFiles = new Set<string>();
const watchedFilesCount: Record<string, number> = {};

const listenerWindows: Set<BrowserWindowWithSafeIpc> = new Set();

const watcher = new FSWatcher({
    disableGlobbing: true,
    awaitWriteFinish: true,
    ignoreInitial: true,
    persistent: false,
});

const sendEvent = (window: BrowserWindowWithSafeIpc, eventType: EventType, path: string) => {
    window.webContents.send('file-changed', eventType, path);
};

const callListeners = (event: EventType, path: string) => {
    for (const window of listenerWindows) {
        sendEvent(window, event, path);
    }
};

watcher.on('error', (e) => log.error(e));
watcher.on('add', (path) => callListeners('add', path));
watcher.on('change', (path) => callListeners('change', path));
watcher.on('unlink', (path) => callListeners('unlink', path));

export const addBrowserWindow = (window: BrowserWindowWithSafeIpc) => {
    listenerWindows.add(window);
};

export const addFile = (path: string) => {
    if (watchedFiles.has(path)) {
        watchedFilesCount[path] += 1;
    } else {
        watchedFiles.add(path);
        watcher.add(path);
        watchedFilesCount[path] = 1;
    }
};

export const addFiles = (paths: readonly string[]) => {
    for (const path of paths) {
        addFile(path);
    }
};

export const removeFile = (path: string) => {
    if (watchedFilesCount[path] === 1) {
        watchedFiles.delete(path);
        delete watchedFilesCount[path];
        watcher.unwatch(path);
    } else {
        watchedFilesCount[path] -= 1;
    }
};

export const removeFiles = (paths: readonly string[]) => {
    for (const path of paths) {
        removeFile(path);
    }
};
