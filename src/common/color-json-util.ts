import { rgb as rgbContrast } from 'wcag-contrast';
import {
    ColorJson,
    ColorKind,
    GrayscaleColorJson,
    OfKind,
    RgbColorJson,
    RgbaColorJson,
} from './common-types';
import { assertNever } from './util';

export const toGrayscale = (color: ColorJson): GrayscaleColorJson => {
    if (color.kind === 'grayscale') return color;
    const [r, g, b] = color.values;
    return { kind: 'grayscale', values: [0.3 * r + 0.5 * g + 0.2 * b] };
};
export const toRgb = (color: ColorJson): RgbColorJson => {
    if (color.kind === 'rgb') return color;
    if (color.kind === 'grayscale') {
        const [luma] = color.values;
        return { kind: 'rgb', values: [luma, luma, luma] };
    }
    const [r, g, b] = color.values;
    return { kind: 'rgb', values: [r, g, b] };
};
export const toRgba = (color: ColorJson): RgbaColorJson => {
    if (color.kind === 'rgba') return color;
    if (color.kind === 'grayscale') {
        const [luma] = color.values;
        return { kind: 'rgba', values: [luma, luma, luma, 1] };
    }
    const [r, g, b] = color.values;
    return { kind: 'rgba', values: [r, g, b, 1] };
};
export const toKind = <K extends ColorKind>(color: ColorJson, kind: K): OfKind<ColorJson, K> => {
    if (kind === 'grayscale') return toGrayscale(color) as never;
    if (kind === 'rgb') return toRgb(color) as never;
    return toRgba(color) as never;
};

export const toCssColor = (color: ColorJson): string => {
    switch (color.kind) {
        case 'grayscale': {
            const [luma] = color.values;
            return `rgb(${luma * 255} ${luma * 255} ${luma * 255})`;
        }
        case 'rgb': {
            const [r, g, b] = color.values;
            return `rgb(${r * 255} ${g * 255} ${b * 255})`;
        }
        case 'rgba': {
            const [r, g, b, a] = color.values;
            return `rgb(${r * 255} ${g * 255} ${b * 255} / ${a})`;
        }
        default:
            return assertNever(color);
    }
};

const withBg = (fg: RgbaColorJson, bg: RgbColorJson): RgbColorJson => {
    const a = fg.values[3];
    return {
        kind: 'rgb',
        values: [
            fg.values[0] * a + bg.values[0] * (1 - a),
            fg.values[1] * a + bg.values[1] * (1 - a),
            fg.values[2] * a + bg.values[2] * (1 - a),
        ],
    };
};
export const getTextColor = (color: ColorJson): 'white' | 'black' => {
    let rgb: [number, number, number];
    if (color.kind === 'grayscale') {
        const luma = color.values[0] * 255;
        rgb = [luma, luma, luma];
    } else {
        if (color.kind === 'rgba') {
            // eslint-disable-next-line no-param-reassign
            color = withBg(color, { kind: 'rgb', values: [0.9, 0.9, 0.9] });
        }
        const [r, g, b] = color.values;
        rgb = [r * 255, g * 255, b * 255];
    }

    const cBlack = rgbContrast(rgb, [0, 0, 0]);
    const cWhite = rgbContrast(rgb, [255, 255, 255]);
    return cBlack > cWhite ? 'black' : 'white';
};
const BG1: RgbColorJson = { kind: 'rgb', values: [0.8, 0.8, 0.8] };
const BG2: RgbColorJson = { kind: 'rgb', values: [1, 1, 1] };
export const getCssBackground = (color: ColorJson): string => {
    if (color.kind === 'rgba' && color.values[3] < 1) {
        return `repeating-conic-gradient(${toCssColor(withBg(color, BG1))} 0% 25%, ${toCssColor(
            withBg(color, BG2),
        )} 0% 50%) 0 0 / 20px 20px`;
    }
    return `${toCssColor(color)}`;
};
