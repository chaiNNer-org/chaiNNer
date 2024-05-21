import { SetStateAction, useCallback } from 'react';
import { useContext } from 'use-context-selector';
import { ChainnerSettings } from '../../common/settings/settings';
import { SettingsContext } from '../contexts/SettingsContext';

export const useSettings = () => {
    return useContext(SettingsContext).settings;
};

export const useMutSetting = <K extends keyof ChainnerSettings>(key: K) => {
    const { settings, setSetting } = useContext(SettingsContext);

    const set = useCallback(
        (update: SetStateAction<ChainnerSettings[K]>) => {
            setSetting(key, update);
        },
        [key, setSetting]
    );

    return [settings[key], set] as const;
};
