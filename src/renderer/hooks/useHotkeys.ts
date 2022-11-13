import { useHotkeys as useHotkeysImpl } from 'react-hotkeys-hook';
import { useContext } from 'use-context-selector';
import { noop } from '../../common/util';
import { HotkeysContext } from '../contexts/HotKeyContext';

export const useHotkeys = (keys: string, callback: () => void): void => {
    const { hotkeysEnabled } = useContext(HotkeysContext);

    const fn = hotkeysEnabled ? callback : noop;

    useHotkeysImpl(keys, fn, [fn]);
};
