import { Type } from '@chainner/navi';
import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { defaultColor, getTypeAccentColors } from '../helpers/accentColors';

export const useTypeColor = (type: Type | undefined) => {
    const { theme } = useSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => (type ? getTypeAccentColors(type) : [defaultColor]), [type, theme]);
};
