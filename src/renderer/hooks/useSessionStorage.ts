import { useEffect, useState } from 'react';

export const getSessionStorageOrDefault = <T>(key: string, defaultValue: T): T => {
    const stored = sessionStorage.getItem(key);
    if (!stored) {
        return defaultValue;
    }
    return JSON.parse(stored) as T;
};

export const useSessionStorage = <T>(key: string, defaultValue: T) => {
    const [value, setValue] = useState(() => getSessionStorageOrDefault(key, defaultValue));

    useEffect(() => {
        sessionStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);

    return [value, setValue] as const;
};
