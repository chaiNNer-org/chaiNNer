import { useCallback, useEffect } from 'react';
import { WindowSize } from '../../common/common-types';
import { debounce } from '../../common/util';
import { useIpcRendererListener } from './useIpcRendererListener';
import { useLocalStorage } from './useLocalStorage';

const defaultSize: WindowSize = {
    maximized: false,
    width: 1280,
    height: 720,
};

export const useLastWindowSize = () => {
    const [, setSize] = useLocalStorage<WindowSize>('use-last-window-size', defaultSize);

    useEffect(() => {
        const listener = debounce(() => {
            setSize((prev) => {
                if (prev.maximized) return prev;
                return {
                    maximized: false,
                    width: window.outerWidth,
                    height: window.outerHeight,
                };
            });
        }, 100);

        window.addEventListener('resize', listener);
        return () => window.removeEventListener('resize', listener);
    }, [setSize]);

    useIpcRendererListener(
        'window-maximized-change',
        useCallback(
            (_, maximized) => {
                setSize((prev) => ({ ...prev, maximized }));
            },
            [setSize]
        )
    );
};
