import { expect, test } from 'vitest';
import { getPngFromClipboard } from '../../src/main/util';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

test('getPngFromClipboard returns undefined when no candidates yield a valid PNG', () => {
    const readBuffer = (): Buffer => Buffer.alloc(0);
    const result = getPngFromClipboard([], readBuffer);
    expect(result).toBeUndefined();
});

test('getPngFromClipboard returns the buffer when the first candidate is a valid PNG', () => {
    const pngData = Buffer.concat([PNG_HEADER, Buffer.from([0x00, 0x00, 0x00, 0x0d])]);
    const readBuffer = (): Buffer => pngData;
    const result = getPngFromClipboard(['image/png'], readBuffer);
    expect(result).toBe(pngData);
});

test('getPngFromClipboard skips invalid candidates and returns the first valid PNG', () => {
    const pngData = Buffer.concat([PNG_HEADER, Buffer.from([0x00, 0x01, 0x00, 0x0d])]);
    const formats = ['image/png', 'PNG', 'public.png'];
    const readBuffer = (format: string): Buffer => {
        if (format === 'PNG') return pngData;
        return Buffer.alloc(0);
    };
    const result = getPngFromClipboard(formats, readBuffer);
    expect(result).toBe(pngData);
});

test('getPngFromClipboard rejects JPEG bytes under a PNG format name', () => {
    const jpegData = Buffer.concat([JPEG_HEADER, Buffer.from([0x00, 0x00, 0x00, 0x00])]);
    const readBuffer = (): Buffer => jpegData;
    const result = getPngFromClipboard(['image/png'], readBuffer);
    expect(result).toBeUndefined();
});

test('getPngFromClipboard rejects empty buffers', () => {
    const readBuffer = (): Buffer => Buffer.alloc(0);
    const result = getPngFromClipboard(['image/png', 'PNG', 'public.png'], readBuffer);
    expect(result).toBeUndefined();
});

test('getPngFromClipboard rejects truncated buffers shorter than the PNG signature', () => {
    const truncated = Buffer.from([0x89, 0x50, 0x4e]);
    const readBuffer = (): Buffer => truncated;
    const result = getPngFromClipboard(['image/png'], readBuffer);
    expect(result).toBeUndefined();
});

test('getPngFromClipboard passes the winning buffer through byte-for-byte without re-encoding', () => {
    const pngData = Buffer.concat([
        PNG_HEADER,
        Buffer.from(Array.from({ length: 100 }, (_, i) => i % 256)),
    ]);
    const readBuffer = (format: string): Buffer => {
        if (format === 'public.png') return pngData;
        return Buffer.alloc(0);
    };
    const result = getPngFromClipboard(['image/png', 'PNG', 'public.png'], readBuffer);
    expect(result).toBeDefined();
    expect(result).toBe(pngData);
    expect(result?.equals(pngData)).toBe(true);
});
