import { describe, expect, it } from 'vitest';
import { getPngFromClipboard } from '../../src/main/util';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('getPngFromClipboard', () => {
    it('returns undefined when no candidates yield a valid PNG', () => {
        const result = getPngFromClipboard([], () => Buffer.alloc(0));
        expect(result).toBeUndefined();
    });

    it('returns the buffer when the first candidate is a valid PNG', () => {
        const readBuffer = (format: string) => {
            if (format === 'image/png') return Buffer.from(PNG_BYTES);
            return Buffer.alloc(0);
        };
        const result = getPngFromClipboard(['image/png'], readBuffer);
        expect(result).toEqual(Buffer.from(PNG_BYTES));
    });

    it('tries candidates in order, skipping invalid ones, and returns the first valid PNG', () => {
        const readBuffer = (format: string) => {
            if (format === 'PNG') return Buffer.from(PNG_BYTES);
            return Buffer.alloc(0);
        };
        const result = getPngFromClipboard(['image/png', 'PNG', 'public.png'], readBuffer);
        expect(result).toEqual(Buffer.from(PNG_BYTES));
    });

    it('rejects non-PNG data (JPEG bytes) under a PNG format name', () => {
        const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
        const readBuffer = (format: string) => {
            if (format === 'image/png') return Buffer.from(jpegBytes);
            return Buffer.alloc(0);
        };
        const result = getPngFromClipboard(['image/png'], readBuffer);
        expect(result).toBeUndefined();
    });

    it('rejects empty buffers', () => {
        const readBuffer = () => Buffer.alloc(0);
        const result = getPngFromClipboard(['image/png'], readBuffer);
        expect(result).toBeUndefined();
    });

    it('rejects truncated buffers (shorter than PNG signature)', () => {
        const shortBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
        const readBuffer = () => Buffer.from(shortBytes);
        const result = getPngFromClipboard(['image/png'], readBuffer);
        expect(result).toBeUndefined();
    });

    it('passes the winning buffer through byte-for-byte without re-encoding', () => {
        const originalBytes = new Uint8Array([
            ...PNG_BYTES,
            0x00,
            0x01,
            0x02,
            0x03,
            0xff,
            0xfe,
            0xfd,
        ]);
        const readBuffer = () => Buffer.from(originalBytes);
        const result = getPngFromClipboard(['image/png'], readBuffer);
        expect(result).toEqual(Buffer.from(originalBytes));
    });
});
