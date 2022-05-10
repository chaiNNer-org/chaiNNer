/* eslint-disable @typescript-eslint/no-shadow */
import React, { useCallback, useMemo, useState } from 'react';
import { createContext } from 'use-context-selector';
import { noop } from '../util';

interface MenuFunctions {
    closeAllMenus: () => void;
    addMenuCloseFunction: (func: () => void, id: string) => void;
}

export const MenuFunctionsContext = createContext<Readonly<MenuFunctions>>({
    closeAllMenus: noop,
    addMenuCloseFunction: noop,
});

export const MenuFunctionsProvider = ({ children }: React.PropsWithChildren<unknown>) => {
    const [menuCloseFunctions, setMenuCloseFunctions] = useState<Record<string, () => void>>({});

    const addMenuCloseFunction = useCallback(
        (func: () => void, id: string) => {
            setMenuCloseFunctions((menuCloseFunctions) => ({ ...menuCloseFunctions, [id]: func }));
        },
        [setMenuCloseFunctions]
    );

    const closeAllMenus = useCallback(() => {
        Object.keys(menuCloseFunctions).forEach((id) => {
            menuCloseFunctions[id]();
        });
    }, [menuCloseFunctions]);

    let contextValue: MenuFunctions = {
        addMenuCloseFunction,
        closeAllMenus,
    };
    contextValue = useMemo(() => contextValue, Object.values(contextValue));

    return (
        <MenuFunctionsContext.Provider value={contextValue}>
            {children}
        </MenuFunctionsContext.Provider>
    );
};
