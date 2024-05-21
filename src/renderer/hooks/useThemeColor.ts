import { useColorMode } from '@chakra-ui/react';
import { useMemo } from 'react';
import { lazy } from '../../common/util';
import { useSettings } from './useSettings';

const light = lazy(() => getComputedStyle(document.documentElement));
const dark = lazy(() => getComputedStyle(document.documentElement));

export const useThemeColor = (name: `--${string}`): string => {
    const { colorMode } = useColorMode();
    const { theme } = useSettings();
    return useMemo(() => {
        const styles = colorMode === 'dark' ? dark() : light();
        return styles.getPropertyValue(name).trim();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [colorMode, name, theme]);
};
