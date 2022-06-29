// From https://stackoverflow.com/questions/5560248/programmatically-lighten-or-darken-a-hex-color-or-rgb-and-blend-colors

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

// Below from https://codepen.io/njmcode/pen/NWdYBy

// Converts a #ffffff hex string into an [r,g,b] array
const h2r = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return [parseInt(result![1], 16), parseInt(result![2], 16), parseInt(result![3], 16)];
};

// Inverse of the above
const r2h = (rgb: number[]): string =>
    // eslint-disable-next-line no-bitwise
    `#${((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2]).toString(16).slice(1)}`;

// Interpolates two [r,g,b] colors and returns an [r,g,b] of the result
// Taken from the awesome ROT.js roguelike dev library at
// https://github.com/ondras/rot.js
const interpolateColorImpl = (color1: number[], color2: number[], factor = 0.5): number[] => {
    const result = color1.slice();
    for (let i = 0; i < 3; i += 1) {
        result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
    }
    return result;
};

export const interpolateColor = (color1: string, color2: string, factor = 0.5): string =>
    r2h(interpolateColorImpl(h2r(color1), h2r(color2), factor));
