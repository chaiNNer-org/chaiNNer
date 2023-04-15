/* eslint-disable no-param-reassign */
import { HsvColor, RgbColor } from 'react-colorful';

export const rgbColorId = ({ r, g, b }: RgbColor): number => {
    return r * 256 * 256 + g * 256 + b;
};
export const hsvColorId = ({ h, s, v }: HsvColor): string => {
    return `${h} ${s} ${v}`;
};

export const rgbEqual = (a: RgbColor, b: RgbColor): boolean => {
    return a.r === b.r && a.g === b.g && a.b === b.b;
};
export const hsvEqual = (a: HsvColor, b: HsvColor): boolean => {
    return a.h === b.h && a.s === b.s && a.v === b.v;
};

export const rgbToHsv = ({ r, g, b }: RgbColor): HsvColor => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const c = max - min;

    let h;
    if (c === 0) {
        h = 0;
    } else if (max === r) {
        h = (g - b) / c + 6;
    } else if (max === g) {
        h = (b - r) / c + 2;
    } else {
        h = (r - g) / c + 4;
    }

    const v = max;
    const s = v === 0 ? 0 : c / v;
    return {
        h: Math.round(h * 60) % 360,
        s: Math.round(s * 100),
        v: Math.round((v / 255) * 100),
    };
};
export const hsvToRgb = ({ h, s, v }: HsvColor): RgbColor => {
    v /= 100;
    s /= 100;

    const f = (n: number) => {
        const k = (n + h / 60) % 6;
        return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    };

    return {
        r: Math.round(f(5) * 255),
        g: Math.round(f(3) * 255),
        b: Math.round(f(1) * 255),
    };
};
