import React, { memo, useMemo } from 'react';
import { createContext } from 'use-context-selector';
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

    // Node Settings
    useNodeFavorites: readonly [
        readonly string[],
        React.Dispatch<React.SetStateAction<readonly string[]>>
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

        const useIsCpu = useMemo(() => [isCpu, setIsCpu] as const, [isCpu]);
        const useIsFp16 = useMemo(() => [isFp16, setIsFp16] as const, [isFp16]);
        const useIsSystemPython = useMemo(
            () => [isSystemPython, setIsSystemPython] as const,
            [isSystemPython]
        );
        const useSnapToGrid = useMemo(
            () =>
                [
                    isSnapToGrid,
                    setIsSnapToGrid,
                    snapToGridAmount || 1,
                    setSnapToGridAmount,
                ] as const,
            [isSnapToGrid, snapToGridAmount]
        );
        const useDisHwAccel = useMemo(
            () => [isDisHwAccel, setIsDisHwAccel] as const,
            [isDisHwAccel]
        );

        // Node Settings
        const [favorites, setFavorites] = useLocalStorage<readonly string[]>('node-favorites', []);

        const useNodeFavorites = useMemo(() => [favorites, setFavorites] as const, [favorites]);

        const contextValue = useMemo<Readonly<Settings>>(
            () => ({
                // Globals
                useIsCpu,
                useIsFp16,
                useIsSystemPython,
                useSnapToGrid,
                useDisHwAccel,

                // Node
                useNodeFavorites,

                // Port
                port,
            }),
            [useIsCpu, useIsFp16, useIsSystemPython, useSnapToGrid, useNodeFavorites, port]
        );

        return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
    }
);
