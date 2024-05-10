import { useColorMode } from '@chakra-ui/react';
import React, { SetStateAction, memo, useCallback, useEffect, useState } from 'react';
import { createContext, useContext } from 'use-context-selector';
import { log } from '../../common/log';
import { ChainnerSettings, defaultSettings } from '../../common/settings/settings';
import { noop } from '../../common/util';
import { useMemoObject } from '../hooks/useMemo';
import { ipcRenderer } from '../safeIpc';

interface SettingsContextValue {
    settings: Readonly<ChainnerSettings>;
    updateSettings: (
        update:
            | Partial<Readonly<ChainnerSettings>>
            | ((prev: Readonly<ChainnerSettings>) => Partial<Readonly<ChainnerSettings>>)
    ) => void;
    setSetting: <K extends keyof ChainnerSettings>(
        key: K,
        update: SetStateAction<ChainnerSettings[K]>
    ) => void;
}

export const SettingsContext = createContext<Readonly<SettingsContextValue>>({
    settings: defaultSettings,
    updateSettings: noop,
    setSetting: noop,
});

export const SettingsProvider = memo(
    ({
        initialSettings,
        children,
    }: React.PropsWithChildren<{ initialSettings: ChainnerSettings }>) => {
        const [settings, setSettings] = useState<ChainnerSettings>(() => ({
            ...defaultSettings,
            ...initialSettings,
        }));
        const [updateCounter, setUpdateCounter] = useState(0);

        const updateSettings: SettingsContextValue['updateSettings'] = useCallback((update) => {
            setSettings((prev) => {
                if (typeof update === 'function') {
                    // eslint-disable-next-line no-param-reassign
                    update = update(prev);
                }
                return { ...prev, ...update };
            });
            setUpdateCounter((prev) => prev + 1);
        }, []);

        const setSetting: SettingsContextValue['setSetting'] = useCallback((key, update) => {
            setSettings((prev) => {
                const oldValue = prev[key];
                const newValue = typeof update === 'function' ? update(oldValue) : update;
                if (oldValue === newValue) return prev;
                return { ...prev, [key]: newValue };
            });
            setUpdateCounter((prev) => prev + 1);
        }, []);

        useEffect(() => {
            if (updateCounter === 0) return;
            ipcRenderer.invoke('set-settings', settings).catch(log.error);
        }, [settings, updateCounter]);

        // update theme
        const { setColorMode } = useColorMode();
        useEffect(() => {
            const [, darkOrLight] = settings.theme.split('-');
            setColorMode(darkOrLight);
            document.documentElement.setAttribute('data-custom-theme', settings.theme);
        }, [setColorMode, settings.theme]);

        const contextValue = useMemoObject<SettingsContextValue>({
            settings,
            updateSettings,
            setSetting,
        });

        return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
    }
);

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
