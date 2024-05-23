import { Type } from '@chainner/navi';
import { useMemo } from 'react';
import { getTypeAccentColors } from '../helpers/accentColors';
import { useSettings } from './useSettings';

export const useTypeColor = (type: Type) => {
    const { theme } = useSettings();
    return useMemo(() => getTypeAccentColors(type, theme), [type, theme]);
};
