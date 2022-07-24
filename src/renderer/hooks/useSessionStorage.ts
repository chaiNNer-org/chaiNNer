import { useEffect, useState } from 'react';
import { safeJsonParse } from '../../common/util';

export const getSessionStorageOrDefault = <T>(key: string, defaultValue: T): T => {
    const stored = sessionStorage.getItem(key);
    if (!stored) {
        return defaultValue;
    }
    return safeJsonParse(stored) as T;
};

export const useSessionStorage = <T>(key: string, defaultValue: T) => {
    const [value, setValue] = useState(() => getSessionStorageOrDefault(key, defaultValue));

    useEffect(() => {
        sessionStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);

    return [value, setValue] as const;
};
