import React, { createContext, useMemo } from 'react';
import useLocalStorage from '../hooks/useLocalStorage';

interface Settings {
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
    port: number;
}

// TODO: create context requires default values
export const SettingsContext = createContext<Readonly<Settings>>({} as Settings);

export const SettingsProvider = ({ children, port }: React.PropsWithChildren<{ port: number }>) => {
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
        () => [isSnapToGrid, setIsSnapToGrid, snapToGridAmount || 1, setSnapToGridAmount] as const,
        [isSnapToGrid, snapToGridAmount]
    );
    const useDisHwAccel = useMemo(() => [isDisHwAccel, setIsDisHwAccel] as const, [isDisHwAccel]);

    const contextValue = useMemo<Readonly<Settings>>(
        () => ({
            useIsCpu,
            useIsFp16,
            useIsSystemPython,
            useSnapToGrid,
            useDisHwAccel,
            port,
        }),
        [useIsCpu, useIsFp16, useIsSystemPython, useSnapToGrid, port]
    );

    return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
};
