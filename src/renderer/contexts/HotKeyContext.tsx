import React, { memo, useCallback, useState } from 'react';
import { createContext } from 'use-context-selector';
import { ipcRenderer } from '../../common/safeIpcRenderer';
import { noop } from '../../common/util';
import { useMemoObject } from '../hooks/useMemo';

interface HotkeysContextState {
    hotkeysEnabled: boolean;
    setHotkeysEnabled: (value: boolean) => void;
}

export const HotkeysContext = createContext<Readonly<HotkeysContextState>>({
    hotkeysEnabled: true,
    setHotkeysEnabled: noop,
});

export const HotkeysProvider = memo(({ children }: React.PropsWithChildren<unknown>) => {
    const [enabled, setEnabled] = useState(true);

    const setHotkeysEnabled = useCallback(
        (value: boolean) => {
            setEnabled(value);
            ipcRenderer.send(value ? 'enable-menu' : 'disable-menu');
        },
        [setEnabled]
    );

    const value = useMemoObject<HotkeysContextState>({
        hotkeysEnabled: enabled,
        setHotkeysEnabled,
    });

    return <HotkeysContext.Provider value={value}>{children}</HotkeysContext.Provider>;
});
