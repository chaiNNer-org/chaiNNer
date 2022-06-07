import { constants } from 'fs';
import fs from 'fs/promises';
import { LocalStorage } from 'node-localstorage';
import { v4 as uuid4, v5 as uuid5 } from 'uuid';

export const checkFileExists = (file: string): Promise<boolean> =>
    fs.access(file, constants.F_OK).then(
        () => true,
        () => false
    );

export const assertNever = (value: never): never => {
    throw new Error(`Unreachable code path. The value ${String(value)} is invalid.`);
};

export const deepCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const noop = () => {};

export interface ParsedHandle {
    nodeId: string;
    inOutId: number;
}
export const parseHandle = (handle: string): ParsedHandle => {
    return {
        nodeId: handle.substring(0, 36), // uuid
        inOutId: Number(handle.substring(37)),
    };
};

export const getLocalStorage = (): Storage => {
    const storage = (global as Record<string, unknown>).customLocalStorage;
    if (storage === undefined) throw new Error('Custom storage not defined');
    return storage as Storage;
};

export const getStorageKeys = (storage: Storage): string[] => {
    if (storage instanceof LocalStorage) {
        // workaround for https://github.com/lmaccherone/node-localstorage/issues/27
        // eslint-disable-next-line no-underscore-dangle
        return (storage as unknown as { _keys: string[] })._keys;
    }
    return Object.keys(storage);
};

export const createUniqueId = () => uuid4();
export const deriveUniqueId = (input: string) =>
    uuid5(input, '48f168a5-48dc-48b3-a7c7-2c3eedb08602');

export const lazy = <T>(fn: () => T): (() => T) => {
    let hasValue = false;
    let value: T;
    return () => {
        if (hasValue) return value;
        value = fn();
        hasValue = true;
        return value;
    };
};

export const debounce = (fn: () => void, delay: number): (() => void) => {
    let id: NodeJS.Timeout | undefined;
    return () => {
        if (id !== undefined) clearTimeout(id);
        id = setTimeout(fn, delay);
    };
};

export const areApproximatelyEqual = (a: number, b: number): boolean => Math.abs(a - b) < 1e-12;

export const removeAnsiEscapeCodes = (text: string): string =>
    text.replace(
        // eslint-disable-next-line no-control-regex
        /\x1b(?:\$[\x28-\x2F].|[\x20-\x2F].|[A-Z\\^_|`{}~]|\[(?:\d*(?:;\d*)*[A-Za-z~]|[78]|[=?]\d+[hl])|\].*?(?:\x1b\\|\x07))/g,
        ''
    );
