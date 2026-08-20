import { constants } from 'fs';
import fs from 'fs/promises';

export const checkFileExists = (file: string): Promise<boolean> =>
    fs.access(file, constants.F_OK).then(
        () => true,
        () => false,
    );

// PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPng(buf: Buffer): boolean {
    return buf.length >= 8 && PNG_SIGNATURE.every((b, i) => buf[i] === b);
}

/**
 * Given candidate clipboard format names, find the first one that yields valid
 * PNG bytes. Returns the PNG buffer or undefined if no candidate is valid.
 *
 * @param formats - Ordered list of candidate clipboard format names
 * @param readBuffer - Function that reads clipboard data for a format name
 */
export function getPngFromClipboard(
    formats: readonly string[],
    readBuffer: (format: string) => Buffer,
): Buffer | undefined {
    for (const format of formats) {
        try {
            const buf = readBuffer(format);
            if (isPng(buf)) {
                return buf;
            }
        } catch {
            // Format not available or read failed, try next candidate
        }
    }
    return undefined;
}
