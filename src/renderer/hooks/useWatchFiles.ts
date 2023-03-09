import { FSWatcher } from 'chokidar';
import log from 'electron-log';
import { useEffect } from 'react';

const listeners = new Set<(file: string) => void>();
const callListeners = (file: string) => {
    log.info(file);
    for (const l of listeners) {
        try {
            l(file);
        } catch (error) {
            log.error(error);
        }
    }
};

const watcher = new FSWatcher({
    disableGlobbing: true,
    awaitWriteFinish: true,
    persistent: false,
});
watcher.on('error', (e) => log.error(e));
watcher.on('add', callListeners);
watcher.on('change', callListeners);
watcher.on('unlink', callListeners);

export const useWatchFiles = (files: readonly string[], onChange: () => void): void => {
    useEffect(() => {
        if (files.length === 0) return;

        const l = (f: string) => {
            if (files.includes(f)) {
                onChange();
            }
        };

        listeners.add(l);
        return () => {
            listeners.delete(l);
        };
    }, [onChange, files]);

    useEffect(() => {
        if (files.length === 0) return;

        watcher.add(files);
        return () => {
            watcher.unwatch(files);
        };
    }, [files]);
};
