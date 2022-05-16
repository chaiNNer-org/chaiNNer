import { useMemo } from 'react';
import { getLocalStorage } from '../../common/util';

export interface UseLastDirectory {
    readonly getLastDirectory: () => string | undefined;
    readonly setLastDirectory: (dir: string) => void;
}

export const useLastDirectory = (key: string): UseLastDirectory => {
    return useMemo<UseLastDirectory>(() => {
        const storage = getLocalStorage();
        const storageKey = `use-last-directory-${key}`;
        return {
            getLastDirectory: () => {
                return storage.getItem(storageKey) || undefined;
            },
            setLastDirectory: (dir) => {
                storage.setItem(storageKey, dir);
            },
        };
    }, [key]);
};
