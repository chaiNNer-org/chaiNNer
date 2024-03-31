import { FSWatcher } from 'chokidar';
import { useEffect } from 'react';
import { log } from '../../common/log';

export type ListenEventType = 'add' | 'change' | 'unlink';

const listeners = new Set<(file: string, type: ListenEventType) => void>();
const callListeners = (file: string, type: ListenEventType) => {
    log.info(file);
    for (const l of listeners) {
        try {
            l(file, type);
        } catch (error) {
            log.error(error);
        }
    }
};

const watcher = new FSWatcher({
    disableGlobbing: true,
    awaitWriteFinish: true,
    ignoreInitial: true,
    persistent: false,
});
watcher.on('error', (e) => log.error(e));
watcher.on('add', (file) => callListeners(file, 'add'));
watcher.on('change', (file) => callListeners(file, 'change'));
watcher.on('unlink', (file) => callListeners(file, 'unlink'));

export const useWatchFiles = (
    files: readonly string[],
    onChange: (type: ListenEventType) => void
): void => {
    useEffect(() => {
        if (files.length === 0) return;

        const l = (f: string, type: ListenEventType) => {
            if (files.includes(f)) {
                onChange(type);
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
