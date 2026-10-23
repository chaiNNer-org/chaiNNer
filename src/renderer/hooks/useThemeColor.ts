import { useColorMode } from '@chakra-ui/react';
import { useMemo } from 'react';
import { lazy } from '../../common/util';
import { useSettings } from './useSettings';

const light = lazy(() => getComputedStyle(document.documentElement));
const dark = lazy(() => getComputedStyle(document.documentElement));

const canvasContext = lazy(() => document.createElement('canvas').getContext('2d'));

/**
 * Converts an opaque CSS color to `#rrggbb`.
 *
 * Sass emits mixed theme shades (e.g. `--theme-175`) as `rgb(86.37%, 89.12%, 92.55%)`,
 * which `Color.fromHex` rejects. A canvas context serializes any opaque sRGB color as hex.
 */
const toHex = (color: string): string => {
    const ctx = canvasContext();
    if (!ctx) return color;
    // An invalid color leaves `fillStyle` unchanged, so reset it first.
    ctx.fillStyle = '#000000';
    ctx.fillStyle = color;
    return typeof ctx.fillStyle === 'string' ? ctx.fillStyle : color;
};

export const useThemeColor = (name: `--${string}`): string => {
    const { colorMode } = useColorMode();
    const { theme } = useSettings();
    return useMemo(() => {
        const styles = colorMode === 'dark' ? dark() : light();
        return toHex(styles.getPropertyValue(name).trim());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [colorMode, name, theme]);
};
