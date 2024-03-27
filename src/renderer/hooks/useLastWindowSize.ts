import { useCallback, useEffect } from 'react';
import { debounce } from '../../common/util';
import { useMutSetting } from '../contexts/SettingsContext';
import { useIpcRendererListener } from './useIpcRendererListener';

export const useLastWindowSize = () => {
    const [, setSize] = useMutSetting('lastWindowSize');

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
