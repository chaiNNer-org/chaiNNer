import { useCallback, useEffect } from 'react';
import { log } from '../../common/log';
import { ipcRenderer } from '../safeIpc';
// eslint-disable-next-line import/no-nodejs-modules
import type { IpcRendererEvent } from 'electron/renderer';

export const useWatchFiles = (files: readonly string[], onChange: () => void): void => {
    const cb = useCallback(
        (event: IpcRendererEvent, eventType: 'add' | 'change' | 'unlink', path: string) => {
            if (files.includes(path)) {
                onChange();
            }
        },
        [files, onChange]
    );

    useEffect(() => {
        if (files.length === 0) return;

        ipcRenderer.invoke('watch-files', files).catch(log.error);
        ipcRenderer.on('file-changed', cb);

        return () => {
            ipcRenderer.invoke('unwatch-files', files).catch(log.error);
            ipcRenderer.removeListener('file-changed', cb);
        };
    }, [cb, files]);
};
