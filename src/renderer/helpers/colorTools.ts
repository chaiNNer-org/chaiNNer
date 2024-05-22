import { Color } from './color';

/**
 * Lightens (percentage > 0) or darkens (percentage < 0) the given hex color.
 */
export const shadeColor = (color: string, percent: number) => {
    return Color.fromHex(color)
        .channelWise((c) => Math.min(Math.round(c * (1 + percent / 100)), 255))
        .hex();
};

export const interpolateColor = (color1: string, color2: string, factor = 0.5) =>
    Color.fromHex(color1).lerpLinear(Color.fromHex(color2), factor).hex();

export const createConicGradient = (colors: readonly string[]): string => {
    if (colors.length === 1) return colors[0];

    const handleColorString = colors
        .map((color, index) => {
            const percent = index / colors.length;
            const nextPercent = (index + 1) / colors.length;
            return `${color} ${percent * 100}% ${nextPercent * 100}%`;
        })
        .join(', ');
    return `conic-gradient(from 90deg, ${handleColorString})`;
};
