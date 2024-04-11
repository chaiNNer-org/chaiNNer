import { expect, test } from 'vitest';
import { compareNumber, sameNumber } from '../../src/common/util';

test('sameNumber', () => {
    // true
    expect(sameNumber(0, 0)).toBe(true);
    expect(sameNumber(Infinity, Infinity)).toBe(true);
    expect(sameNumber(-Infinity, -Infinity)).toBe(true);
    expect(sameNumber(NaN, NaN)).toBe(true);

    // false
    expect(sameNumber(-2, 0)).toBe(false);
});

test('compareNumber', () => {
    const numbers = [
        0,
        -0,
        1,
        -1,
        2,
        -2,
        Number.MAX_VALUE,
        Number.MIN_VALUE,
        Number.EPSILON,
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        Infinity,
        -Infinity,
        NaN,
    ];

    const a = [...numbers].sort(compareNumber);
    const b = [...numbers].reverse().sort(compareNumber);

    expect(a).toStrictEqual(b);
});
