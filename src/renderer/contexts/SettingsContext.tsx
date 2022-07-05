import React, { memo, useMemo } from 'react';
import { createContext } from 'use-context-selector';
import { SchemaId } from '../../common/common-types';
import useLocalStorage from '../hooks/useLocalStorage';

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

    // Port
    port: number;
}

// TODO: create context requires default values
export const SettingsContext = createContext<Readonly<Settings>>({} as Settings);

export const SettingsProvider = memo(
    ({ children, port }: React.PropsWithChildren<{ port: number }>) => {
        // Global Settings
        const [isCpu, setIsCpu] = useLocalStorage('is-cpu', false);
        const [isFp16, setIsFp16] = useLocalStorage('is-fp16', false);
        const [isSystemPython, setIsSystemPython] = useLocalStorage('use-system-python', false);
        const [isSnapToGrid, setIsSnapToGrid] = useLocalStorage('snap-to-grid', false);
        const [snapToGridAmount, setSnapToGridAmount] = useLocalStorage('snap-to-grid-amount', 15);
        const [isDisHwAccel, setIsDisHwAccel] = useLocalStorage('disable-hw-accel', false);
        const [startupTemplate, setStartupTemplate] = useLocalStorage('startup-template', '');
        const [isDarkMode, setIsDarkMode] = useLocalStorage('use-dark-mode', true);
        const [animateChain, setAnimateChain] = useLocalStorage('animate-chain', true);

        const useIsCpu = useMemo(() => [isCpu, setIsCpu] as const, [isCpu, setIsCpu]);
        const useIsFp16 = useMemo(() => [isFp16, setIsFp16] as const, [isFp16, setIsFp16]);
        const useIsSystemPython = useMemo(
            () => [isSystemPython, setIsSystemPython] as const,
            [isSystemPython, setIsSystemPython]
        );
        const useSnapToGrid = useMemo(
            () =>
                [
                    isSnapToGrid,
                    setIsSnapToGrid,
                    snapToGridAmount || 1,
                    setSnapToGridAmount,
                ] as const,
            [isSnapToGrid, setIsSnapToGrid, snapToGridAmount, setSnapToGridAmount]
        );
        const useDisHwAccel = useMemo(
            () => [isDisHwAccel, setIsDisHwAccel] as const,
            [isDisHwAccel, setIsDisHwAccel]
        );
        const useStartupTemplate = useMemo(
            () => [startupTemplate, setStartupTemplate] as const,
            [startupTemplate, setStartupTemplate]
        );
        const useIsDarkMode = useMemo(
            () => [isDarkMode, setIsDarkMode] as const,
            [isDarkMode, setIsDarkMode]
        );
        const useAnimateChain = useMemo(
            () => [animateChain, setAnimateChain] as const,
            [animateChain, setAnimateChain]
        );

        // Node Settings
        const [favorites, setFavorites] = useLocalStorage<readonly SchemaId[]>(
            'node-favorites',
            []
        );

        const useNodeFavorites = useMemo(
            () => [favorites, setFavorites] as const,
            [favorites, setFavorites]
        );

        // eslint-disable-next-line react/jsx-no-constructed-context-values
        let contextValue: Readonly<Settings> = {
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

            // Port
            port,
        };
        contextValue = useMemo(() => contextValue, Object.values(contextValue));

        return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
    }
);
