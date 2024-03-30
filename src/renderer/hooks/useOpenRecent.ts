import { useCallback, useEffect } from 'react';
import { EMPTY_ARRAY } from '../../common/util';
import { ipcRenderer } from '../safeIpc';
import { useIpcRendererListener } from './useIpcRendererListener';
import { useStored } from './useStored';

const MAX_ENTRIES = 20;

export const useOpenRecent = () => {
    const [recentlyOpen, setRecentlyOpen] = useStored<readonly string[]>('recent', EMPTY_ARRAY);

    useEffect(() => {
        ipcRenderer.send('update-open-recent-menu', recentlyOpen as string[]);
    }, [recentlyOpen]);

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
                return prev.filter((p) => p !== path);
            }),
        [setRecentlyOpen]
    );

    useIpcRendererListener(
        'clear-open-recent',
        useCallback(() => setRecentlyOpen([]), [setRecentlyOpen])
    );

    return [recentlyOpen, push, remove] as const;
};
