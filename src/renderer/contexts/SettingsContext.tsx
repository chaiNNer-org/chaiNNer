import { useColorMode } from '@chakra-ui/react';
import React, { memo, useEffect } from 'react';
import { createContext } from 'use-context-selector';
import { PackageSettings, SchemaId } from '../../common/common-types';
import { GetSetState, SetState } from '../helpers/types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useMemoArray, useMemoObject } from '../hooks/useMemo';

interface Settings {
    // Global Settings
    useBackendSettings: GetSetState<PackageSettings>;
    useIsSystemPython: GetSetState<boolean>;
    useSystemPythonLocation: GetSetState<string | null>;
    useCheckUpdOnStrtUp: GetSetState<boolean>;
    useSnapToGrid: readonly [
        snapToGrid: boolean,
        setSnapToGrid: SetState<boolean>,
        snapToGridAmount: number,
        setSnapToGridAmount: SetState<number>,
    ];
    useStartupTemplate: GetSetState<string>;
    useSelectTheme: GetSetState<string>;
    useAnimateChain: GetSetState<boolean>;
    useExperimentalFeatures: GetSetState<boolean>;
    useEnableHardwareAcceleration: GetSetState<boolean>;
    useViewportExportPadding: GetSetState<number>;
    useAllowMultipleInstances: GetSetState<boolean>;

    // Node Settings
    useNodeFavorites: GetSetState<readonly SchemaId[]>;
    useNodeSelectorCollapsed: GetSetState<boolean>;
}

// TODO: create context requires default values
export const SettingsContext = createContext<Readonly<Settings>>({} as Settings);

export const SettingsProvider = memo(({ children }: React.PropsWithChildren<unknown>) => {
    const useBackendSettings = useMemoArray(useLocalStorage('backend-settings', {}));

    const useIsSystemPython = useMemoArray(useLocalStorage('use-system-python', false));
    const useSystemPythonLocation = useMemoArray(
        useLocalStorage<string | null>('system-python-location', null),
    );
    const useCheckUpdOnStrtUp = useMemoArray(useLocalStorage('check-upd-on-strtup-2', true));
    const useStartupTemplate = useMemoArray(useLocalStorage('startup-template', ''));

    const useSelectTheme = useMemoArray(useLocalStorage('theme', 'dark'));

    const { setColorMode } = useColorMode();
    const [selectThemeColor] = useSelectTheme;
    useEffect(() => {
        setColorMode(selectThemeColor);
    }, [setColorMode, selectThemeColor]);

    const useAnimateChain = useMemoArray(useLocalStorage('animate-chain', true));

    // Snap to grid
    const [isSnapToGrid, setIsSnapToGrid] = useLocalStorage('snap-to-grid', false);
    const [snapToGridAmount, setSnapToGridAmount] = useLocalStorage('snap-to-grid-amount', 16);
    const useSnapToGrid = useMemoArray([
        isSnapToGrid,
        setIsSnapToGrid,
        snapToGridAmount || 1,
        setSnapToGridAmount,
    ] as const);

    const useViewportExportPadding = useMemoArray(useLocalStorage('viewport-export-padding', 20));

    // Node Settings
    const useNodeFavorites = useMemoArray(
        useLocalStorage<readonly SchemaId[]>('node-favorites', []),
    );
    const useNodeSelectorCollapsed = useMemoArray(
        useLocalStorage('node-selector-collapsed', false),
    );

    const useExperimentalFeatures = useMemoArray(useLocalStorage('experimental-features', false));
    const useEnableHardwareAcceleration = useMemoArray(
        useLocalStorage('enable-hardware-acceleration', false),
    );
    const useAllowMultipleInstances = useMemoArray(
        useLocalStorage('allow-multiple-instances', false),
    );

    const contextValue = useMemoObject<Settings>({
        // Globals
        useBackendSettings,
        useIsSystemPython,
        useSystemPythonLocation,
        useSnapToGrid,
        useCheckUpdOnStrtUp,
        useStartupTemplate,
        useSelectTheme,
        useAnimateChain,
        useExperimentalFeatures,
        useEnableHardwareAcceleration,
        useViewportExportPadding,
        useAllowMultipleInstances,

        // Node
        useNodeFavorites,
        useNodeSelectorCollapsed,
    });

    return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
});
