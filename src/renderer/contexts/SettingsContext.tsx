import { useColorMode } from '@chakra-ui/react';
import React, { memo, useEffect } from 'react';
import { createContext } from 'use-context-selector';
import { SchemaId } from '../../common/common-types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useMemoArray, useMemoObject } from '../hooks/useMemo';

interface Settings {
    // Global settings
    useIsCpu: readonly [boolean, React.Dispatch<React.SetStateAction<boolean>>];
    useIsFp16: readonly [boolean, React.Dispatch<React.SetStateAction<boolean>>];
    useIsSystemPython: readonly [boolean, React.Dispatch<React.SetStateAction<boolean>>];
    useDisHwAccel: readonly [boolean, React.Dispatch<React.SetStateAction<boolean>>];
    useSnapToGrid: readonly [
        snapToGrid: boolean,
        setSnapToGrid: React.Dispatch<React.SetStateAction<boolean>>,
        snapToGridAmount: number,
        setSnapToGridAmount: React.Dispatch<React.SetStateAction<number>>
    ];
    useStartupTemplate: readonly [string, React.Dispatch<React.SetStateAction<string>>];
    useIsDarkMode: readonly [boolean, React.Dispatch<React.SetStateAction<boolean>>];
    useAnimateChain: readonly [boolean, React.Dispatch<React.SetStateAction<boolean>>];

    // Node Settings
    useNodeFavorites: readonly [
        readonly SchemaId[],
        React.Dispatch<React.SetStateAction<readonly SchemaId[]>>
    ];
    useNodeSelectorCollapsed: readonly [boolean, React.Dispatch<React.SetStateAction<boolean>>];

    // Port
    port: number;
}

// TODO: create context requires default values
export const SettingsContext = createContext<Readonly<Settings>>({} as Settings);

export const SettingsProvider = memo(
    ({ children, port }: React.PropsWithChildren<{ port: number }>) => {
        // Global Settings
        const useIsCpu = useMemoArray(useLocalStorage('is-cpu', false));
        const useIsFp16 = useMemoArray(useLocalStorage('is-fp16', false));
        const useIsSystemPython = useMemoArray(useLocalStorage('use-system-python', false));
        const useDisHwAccel = useMemoArray(useLocalStorage('disable-hw-accel', false));
        const useStartupTemplate = useMemoArray(useLocalStorage('startup-template', ''));

        const useIsDarkMode = useMemoArray(useLocalStorage('use-dark-mode', true));

        const { setColorMode } = useColorMode();
        const [isDarkMode] = useIsDarkMode;
        useEffect(() => {
            setColorMode(isDarkMode ? 'dark' : 'light');
        }, [setColorMode, isDarkMode]);

        const useAnimateChain = useMemoArray(useLocalStorage('animate-chain', true));

        // Snap to grid
        const [isSnapToGrid, setIsSnapToGrid] = useLocalStorage('snap-to-grid', false);
        const [snapToGridAmount, setSnapToGridAmount] = useLocalStorage('snap-to-grid-amount', 15);
        const useSnapToGrid = useMemoArray([
            isSnapToGrid,
            setIsSnapToGrid,
            snapToGridAmount || 1,
            setSnapToGridAmount,
        ] as const);

        // Node Settings
        const useNodeFavorites = useMemoArray(
            useLocalStorage<readonly SchemaId[]>('node-favorites', [])
        );
        const useNodeSelectorCollapsed = useMemoArray(
            useLocalStorage('node-selector-collapsed', false)
        );

        const contextValue = useMemoObject<Settings>({
            // Globals
            useIsCpu,
            useIsFp16,
            useIsSystemPython,
            useSnapToGrid,
            useDisHwAccel,
            useStartupTemplate,
            useIsDarkMode,
            useAnimateChain,

            // Node
            useNodeFavorites,
            useNodeSelectorCollapsed,

            // Port
            port,
        });

        return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
    }
);
