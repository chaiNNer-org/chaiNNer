import { useCallback } from 'react';
import { EMPTY_OBJECT } from '../../common/util';
import { useStored } from './useStored';

export interface UseLastDirectory {
    readonly lastDirectory: string | undefined;
    readonly setLastDirectory: (dir: string) => void;
}

export const useLastDirectory = (key: string): UseLastDirectory => {
    const [lastDirectories, setLastDirectories] = useStored<Record<string, string | undefined>>(
        'lastDirectories',
        EMPTY_OBJECT
    );

    const setLastDirectory = useCallback(
        (dir: string) => {
            setLastDirectories((prev) => ({ ...prev, [key]: dir }));
        },
        [setLastDirectories, key]
    );

    return {
        lastDirectory: lastDirectories[key],
        setLastDirectory,
    };
};
