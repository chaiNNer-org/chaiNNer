import React, { useCallback, useMemo, useState } from 'react';
import { createContext } from 'use-context-selector';
import { noop } from '../util';

interface MenuFunctions {
    closeAllMenus: () => void;
    addMenuCloseFunction: (func: () => void, id: string) => () => void;
}

export const MenuFunctionsContext = createContext<Readonly<MenuFunctions>>({
    closeAllMenus: noop,
    addMenuCloseFunction: () => noop,
});

export const MenuFunctionsProvider = ({ children }: React.PropsWithChildren<unknown>) => {
    const [menuCloseFunctions, setMenuCloseFunctions] = useState<Record<string, () => void>>({});

    const addMenuCloseFunction = useCallback(
        (func: () => void, id: string) => {
            setMenuCloseFunctions((funcs) => ({ ...funcs, [id]: func }));

            return () => {
                setMenuCloseFunctions((funcs) => {
                    const copy = { ...funcs };
                    delete copy[id];
                    return copy;
                });
            };
        },
        [setMenuCloseFunctions]
    );

    const closeAllMenus = useCallback(() => {
        Object.values(menuCloseFunctions).forEach((fn) => fn());
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
