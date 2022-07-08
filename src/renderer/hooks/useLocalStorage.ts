import { useEffect, useState } from 'react';
import { getLocalStorage } from '../../common/util';

const getLocalStorageOrDefault = <T>(key: string, defaultValue: T): T => {
    const customStorage = getLocalStorage();

    const stored = customStorage.getItem(key);
    if (stored === null) {
        return defaultValue;
    }
    return JSON.parse(stored) as T;
};

export const useLocalStorage = <T>(key: string, defaultValue: T) => {
    const [value, setValue] = useState(() => getLocalStorageOrDefault(key, defaultValue));

    useEffect(() => {
        getLocalStorage().setItem(key, JSON.stringify(value));
    }, [key, value]);

    return [value, setValue] as const;
};
