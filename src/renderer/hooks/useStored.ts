import { Dispatch, SetStateAction, useCallback } from 'react';
import { useContext } from 'use-context-selector';
import { SettingsContext } from '../contexts/SettingsContext';

const getStored = <T>(storage: Record<string, unknown>, key: string, defaultValue: T): T => {
    return (storage[key] as T | undefined) ?? defaultValue;
};

export const useStored = <T>(
    key: string,
    defaultValue: T
): readonly [T, Dispatch<SetStateAction<T>>] => {
    const { settings, setSetting } = useContext(SettingsContext);

    const setValue = useCallback(
        (value: SetStateAction<T>) => {
            setSetting('storage', (prev) => {
                const newValue =
                    typeof value === 'function'
                        ? (value as (prev: T) => T)(getStored(prev, key, defaultValue))
                        : value;
                return { ...prev, [key]: newValue };
            });
        },
        [setSetting, key, defaultValue]
    );

    return [getStored(settings.storage, key, defaultValue), setValue] as const;
};
