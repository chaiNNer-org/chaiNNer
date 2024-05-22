// From https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors

import { parseRgbHex } from './colorUtil';

/**
 * Lightens (percentage > 0) or darkens (percentage < 0) the given hex color.
 *
 * The color has to be in the form `#RRGGBB`.
 */
export const shadeColor = (color: string, percent: number): `#${string}` => {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = Math.min(Math.round(R * (1 + percent / 100)), 255);
    G = Math.min(Math.round(G * (1 + percent / 100)), 255);
    B = Math.min(Math.round(B * (1 + percent / 100)), 255);

    const RR = R.toString(16).padStart(2, '0');
    const GG = G.toString(16).padStart(2, '0');
    const BB = B.toString(16).padStart(2, '0');

    return `#${RR}${GG}${BB}`;
};

// Modified from https://codepen.io/njmcode/pen/NWdYBy

// Converts a #ffffff hex string into an [r,g,b] array
const hexToRgb = (hex: string): [number, number, number] => {
    const color = parseRgbHex(hex);
    if (!color) {
        throw new Error(`Invalid hex color: ${hex}`);
    }
    return [color.r, color.g, color.b];
};

// Inverse of the above
const rgbToHex = (rgb: [number, number, number]): string =>
    // eslint-disable-next-line no-bitwise
    `#${((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1)}`;

// Interpolates two [r,g,b] colors and returns an [r,g,b] of the result
// Taken from the awesome ROT.js roguelike dev library at
// https://github.com/ondras/rot.js
const interpolateColorImpl = (
    color1: [number, number, number],
    color2: [number, number, number],
    factor = 0.5
): [number, number, number] => {
    const result = color1.slice() as [number, number, number];
    for (let i = 0; i < 3; i += 1) {
        const c1 = color1[i] ** 2.2;
        const c2 = color2[i] ** 2.2;
        const blend = c1 + factor * (c2 - c1);
        result[i] = Math.round(blend ** (1 / 2.2));
    }
    return result;
};

export const interpolateColor = (color1: string, color2: string, factor = 0.5): string =>
    rgbToHex(interpolateColorImpl(hexToRgb(color1), hexToRgb(color2), factor));

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
