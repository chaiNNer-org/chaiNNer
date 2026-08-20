import { constants } from 'fs';
import fs from 'fs/promises';

export const checkFileExists = (file: string): Promise<boolean> =>
    fs.access(file, constants.F_OK).then(
        () => true,
        () => false
    );

export type ReadBufferFn = (format: string) => Buffer;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const isPng = (buf: Buffer): boolean =>
    buf.length >= PNG_SIGNATURE.length &&
    buf.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);

export const getPngFromClipboard = (
    formats: readonly string[],
    readBuffer: ReadBufferFn
): Buffer | undefined => {
    for (const format of formats) {
        const buf = readBuffer(format);
        if (isPng(buf)) {
            return buf;
        }
    }
    return undefined;
};
