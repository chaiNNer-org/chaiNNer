import { useEffect, useState } from 'react';
import { getLocalStorage } from '../util';

// TODO: Remove old localStorage code once enough time has passed that most users have migrated

const getLocalStorageOrDefault = <T>(key: string, defaultValue: T): T => {
    const customStorage = getLocalStorage();

    const stored = customStorage.getItem(key);
    const old = localStorage.getItem(key);
    if (stored === null) {
        if (old !== null) {
            customStorage.setItem(key, old);
            localStorage.removeItem(key);
            return JSON.parse(old) as T;
        }
        return defaultValue;
    }
    return JSON.parse(stored) as T;
};

const useLocalStorage = <T>(key: string, defaultValue: T) => {
    const [value, setValue] = useState(() => getLocalStorageOrDefault(key, defaultValue));

    useEffect(() => {
        getLocalStorage().setItem(key, JSON.stringify(value));
    }, [key, value]);

    return [value, setValue] as const;
};

export default useLocalStorage;
