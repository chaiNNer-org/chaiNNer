import React, { memo } from 'react';
import { createContext } from 'use-context-selector';
import { useMemoObject } from '../hooks/useMemo';

interface InputContextState {
    /**
     * Whether the input is inactive (unused) due to some other input value.
     *
     * Such inactive inputs are usually not rendered, but they have to be if
     * they have a connection.
     */
    conditionallyInactive: boolean;
}

export const InputContext = createContext<Readonly<InputContextState>>({
    conditionallyInactive: false,
});

export const WithInputContext = memo(
    ({ conditionallyInactive, children }: React.PropsWithChildren<InputContextState>) => {
        const value = useMemoObject<InputContextState>({
            conditionallyInactive,
        });

        return <InputContext.Provider value={value}>{children}</InputContext.Provider>;
    }
);
