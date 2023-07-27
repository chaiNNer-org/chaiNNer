import React, { memo } from 'react';
import { createContext } from 'use-context-selector';
import { useMemoObject } from '../hooks/useMemo';

interface FakeNodeContextState {
    isFake: boolean;
}

export const FakeNodeContext = createContext<Readonly<FakeNodeContextState>>({
    isFake: false,
});

export const FakeNodeProvider = memo(
    ({ children, isFake }: React.PropsWithChildren<FakeNodeContextState>) => {
        const value = useMemoObject<FakeNodeContextState>({ isFake });

        return <FakeNodeContext.Provider value={value}>{children}</FakeNodeContext.Provider>;
    }
);
