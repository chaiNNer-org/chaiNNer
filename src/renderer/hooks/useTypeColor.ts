import { Type } from '@chainner/navi';
import { useMemo } from 'react';
import { defaultColor, getTypeAccentColors } from '../helpers/accentColors';
import { useSettings } from './useSettings';

export const useTypeColor = (type: Type | undefined) => {
    const { theme } = useSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => (type ? getTypeAccentColors(type) : [defaultColor]), [type, theme]);
};
