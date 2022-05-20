import { useCallback, useEffect } from 'react';
import { ipcRenderer } from '../../common/safeIpc';
import { useIpcRendererListener } from './useIpcRendererListener';
import useLocalStorage from './useLocalStorage';

const MAX_ENTRIES = 20;

export const useOpenRecent = () => {
    const [recentlyOpen, setRecentlyOpen] = useLocalStorage<readonly string[]>(
        'use-recently-open',
        []
    );

    useEffect(() => {
        ipcRenderer.send('update-open-recent-menu', recentlyOpen as string[]);
    }, []);

    const push = useCallback(
        (path: string): void =>
            setRecentlyOpen((prev) => {
                if (prev.includes(path)) {
                    // nothing changed
                    if (prev[prev.length - 1] === path) return prev;

                    // eslint-disable-next-line no-param-reassign
                    prev = prev.filter((p) => p !== path);
                }
                const newPaths = [...prev, path];
                if (newPaths.length > MAX_ENTRIES)
                    newPaths.splice(0, newPaths.length - MAX_ENTRIES);

                ipcRenderer.send('update-open-recent-menu', newPaths);

                return newPaths;
            }),
        [setRecentlyOpen]
    );

    const remove = useCallback(
        (path: string): void =>
            setRecentlyOpen((prev) => {
                if (!prev.includes(path)) {
                    return prev;
                }
                const newPaths = prev.filter((p) => p !== path);

                ipcRenderer.send('update-open-recent-menu', newPaths);

                return newPaths;
            }),
        [setRecentlyOpen]
    );

    useIpcRendererListener(
        'clear-open-recent',
        () => {
            setRecentlyOpen([]);
            ipcRenderer.send('update-open-recent-menu', []);
        },
        [setRecentlyOpen]
    );

    return [recentlyOpen, push, remove] as const;
};
