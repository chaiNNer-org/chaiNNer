export interface RgbColorLike {
    r: number;
    g: number;
    b: number;
}

/**
 * An 8-bit RGB color.
 */
export class Color {
    r: number;

    g: number;

    b: number;

    get id() {
        return this.r * 256 * 256 + this.g * 256 + this.b;
    }

    hex(): `#${string}` {
        const hex = (Math.round(this.r) * 256 * 256 + Math.round(this.g) * 256 + Math.round(this.b))
            .toString(16)
            .padStart(6, '0');
        return `#${hex}`;
    }

    constructor(r: number, g: number, b: number) {
        this.r = Math.round(r);
        this.g = Math.round(g);
        this.b = Math.round(b);
    }

    static from({ r, g, b }: Readonly<RgbColorLike>): Color {
        return new Color(r, g, b);
    }

    static fromHex(hex: string): Color {
        let h = hex;
        if (h.startsWith('#')) {
            h = h.slice(1);
        }
        if (/^[0-9a-f]+$/i.test(h)) {
            if (h.length === 3) {
                const r = Number.parseInt(h[0], 16) * 17;
                const g = Number.parseInt(h[1], 16) * 17;
                const b = Number.parseInt(h[2], 16) * 17;
                return new Color(r, g, b);
            }
            if (h.length === 6) {
                const r = Number.parseInt(h.slice(0, 2), 16);
                const g = Number.parseInt(h.slice(2, 4), 16);
                const b = Number.parseInt(h.slice(4, 6), 16);
                return new Color(r, g, b);
            }
        }
        throw new Error(`Invalid hex color: ${hex}`);
    }

    equals(other: Readonly<RgbColorLike>): boolean {
        return this.r === other.r && this.g === other.g && this.b === other.b;
    }

    with({ r, g, b }: Partial<Readonly<RgbColorLike>>): Color {
        return new Color(r ?? this.r, g ?? this.g, b ?? this.b);
    }

    hsv(): HsvColor {
        const max = Math.max(this.r, this.g, this.b);
        const min = Math.min(this.r, this.g, this.b);
        const c = max - min;

        let h;
        if (c === 0) {
            h = 0;
        } else if (max === this.r) {
            h = (this.g - this.b) / c + 6;
        } else if (max === this.g) {
            h = (this.b - this.r) / c + 2;
        } else {
            h = (this.r - this.g) / c + 4;
        }

        const v = max;
        const s = v === 0 ? 0 : c / v;
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return new HsvColor(
            Math.round(h * 60) % 360,
            Math.round(s * 100),
            Math.round((v / 255) * 100)
        );
    }

    /**
     * Returns a new color with the given operation applied to each channel.
     */
    channelWise(operation: (channel: number) => number): Color {
        return new Color(operation(this.r), operation(this.g), operation(this.b));
    }

    /**
     * Returns a new color that is the linear interpolation between this color and the other color.
     */
    lerp(other: Readonly<RgbColorLike>, factor: number): Color {
        return new Color(
            Math.round(this.r + (other.r - this.r) * factor),
            Math.round(this.g + (other.g - this.g) * factor),
            Math.round(this.b + (other.b - this.b) * factor)
        );
    }

    /**
     * Returns a new color that is the linear interpolation between this color and the other color in linear RGB.
     */
    lerpLinear(other: Readonly<RgbColorLike>, factor: number): Color {
        const gamma = 2.2;
        const lerp = (a: number, b: number) => {
            return Math.round((a ** gamma + factor * (b ** gamma - a ** gamma)) ** (1 / gamma));
        };
        return new Color(lerp(this.r, other.r), lerp(this.g, other.g), lerp(this.b, other.b));
    }
}

export interface HsvColorLike {
    h: number;
    s: number;
    v: number;
}

/**
 * An HSV color.
 */
export class HsvColor {
    /** Range: 0-360 */
    h: number;

    /** Range: 0-100 */
    s: number;

    /** Range: 0-100 */
    v: number;

    get id() {
        return this.h * 100 * 100 + this.s * 100 + this.v;
    }

    constructor(h: number, s: number, v: number) {
        this.h = h;
        this.s = s;
        this.v = v;
    }

    static from({ h, s, v }: Readonly<HsvColorLike>): HsvColor {
        return new HsvColor(h, s, v);
    }

    equals(other: Readonly<HsvColorLike>): boolean {
        return this.h === other.h && this.s === other.s && this.v === other.v;
    }

    with({ h, s, v }: Partial<Readonly<HsvColorLike>>): HsvColor {
        return new HsvColor(h ?? this.h, s ?? this.s, v ?? this.v);
    }

    rgb(): Color {
        const v = this.v / 100;
        const s = this.s / 100;

        const f = (n: number) => {
            const k = (n + this.h / 60) % 6;
            return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
        };

        return new Color(Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255));
    }
}
