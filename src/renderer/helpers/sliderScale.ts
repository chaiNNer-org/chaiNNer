export interface Scale {
    toScale(value: number): number;
    fromScale(scaledValue: number): number;
}

export const LINEAR_SCALE: Scale = { toScale: (n) => n, fromScale: (n) => n };

export class LogScale implements Scale {
    public readonly min: number;

    public readonly max: number;

    public readonly precision: number;

    public readonly offset: number;

    constructor(min: number, max: number, precision: number, offset = 0) {
        this.min = min;
        this.max = max;
        this.precision = precision;
        this.offset = offset;
    }

    toScale(value: number): number {
        return Math.log1p(value - (this.min + this.offset));
    }

    fromScale(scaledValue: number): number {
        let value = Math.expm1(scaledValue) + (this.min + this.offset);

        // 2 digits of precision
        if (this.min < value && value < this.max) {
            value = Number(value.toExponential(2));
            if (value > 0) {
                // we only want 1 fractional digit for numbers between 2*10^k and 10^(k+1)
                const k = Math.floor(Math.log10(value));
                if (value >= 2 * 10 ** k) {
                    value = Number(value.toExponential(1));
                }
            }
        }

        return Number(value.toFixed(this.precision));
    }
}

export class PowerScale implements Scale {
    public readonly power: number;

    public readonly min: number;

    public readonly precision: number;

    constructor(power: number, min: number, precision: number) {
        this.power = power;
        this.min = min;
        this.precision = precision;
    }

    toScale(value: number): number {
        return (value - this.min) ** this.power;
    }

    fromScale(scaledValue: number): number {
        const value = scaledValue ** (1 / this.power) + this.min;
        return Number(value.toFixed(this.precision));
    }
}
