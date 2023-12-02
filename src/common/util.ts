import { constants } from 'fs';
import fs from 'fs/promises';
import { LocalStorage } from 'node-localstorage';
import { v4 as uuid4, v5 as uuid5 } from 'uuid';
import type { Input, InputData, InputId, InputValue, NodeSchema, OutputId } from './common-types';

export const EMPTY_ARRAY: readonly never[] = [];
export const EMPTY_SET: ReadonlySet<never> = new Set<never>();
export const EMPTY_MAP: ReadonlyMap<never, never> = new Map<never, never>();
export const EMPTY_OBJECT: Readonly<Record<string, never>> = Object.freeze({});

export const noop = () => {};

export const checkFileExists = (file: string): Promise<boolean> =>
    fs.access(file, constants.F_OK).then(
        () => true,
        () => false,
    );

export const assertNever = (value: never): never => {
    throw new Error(`Unreachable code path. The value ${String(value)} is invalid.`);
};
export const assertType: <T>(_: T) => void = noop;

export const isReadonlyArray = Array.isArray as (value: unknown) => value is readonly unknown[];

export const deepCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const findLastIndex = <T>(
    array: readonly T[],
    predicate: (value: T, index: number, obj: readonly T[]) => unknown,
): number => {
    for (let i = array.length - 1; i >= 0; i -= 1) {
        if (predicate(array[i], i, array)) {
            return i;
        }
    }
    return -1;
};
export const findLast = <T>(
    array: readonly T[],
    predicate: (value: T, index: number, obj: readonly T[]) => unknown,
): T | undefined => {
    const index = findLastIndex(array, predicate);
    if (index === -1) return undefined;
    return array[index];
};

export interface ParsedSourceHandle {
    nodeId: string;
    outputId: OutputId;
}
export interface ParsedTargetHandle {
    nodeId: string;
    inputId: InputId;
}
export const parseSourceHandle = (handle: string): ParsedSourceHandle => {
    return {
        nodeId: handle.substring(0, 36),
        outputId: Number(handle.substring(37)) as OutputId,
    };
};
export const parseTargetHandle = (handle: string): ParsedTargetHandle => {
    return {
        nodeId: handle.substring(0, 36),
        inputId: Number(handle.substring(37)) as InputId,
    };
};
export const stringifySourceHandle = (handle: ParsedSourceHandle): string =>
    `${handle.nodeId}-${handle.outputId}`;
export const stringifyTargetHandle = (handle: ParsedTargetHandle): string =>
    `${handle.nodeId}-${handle.inputId}`;

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
// eslint-disable-next-line @typescript-eslint/ban-types
export const lazyKeyed = <K extends object, T extends {} | null>(
    fn: (key: K) => T,
): ((key: K) => T) => {
    const cache = new WeakMap<K, T>();
    return (key) => {
        let value = cache.get(key);
        if (value === undefined) {
            value = fn(key);
            cache.set(key, value);
        }
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

export const sameNumber = (a: number, b: number): boolean =>
    a === b || (Number.isNaN(a) && Number.isNaN(b));

// eslint-disable-next-line no-nested-ternary
export const binaryCompare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export type Comparator<T> = (a: T, b: T) => number;
export const compareSequences = <T>(
    a: readonly T[],
    b: readonly T[],
    compare: Comparator<T>,
): number => {
    if (a.length !== b.length) return a.length - b.length;
    for (let i = 0; i < a.length; i += 1) {
        const r = compare(a[i], b[i]);
        if (r !== 0) return r;
    }
    return 0;
};

/**
 * Sorts numbers in the order:
 * 1. -Infinity
 * 2. Negative real numbers. E.g. -2
 * 3. -0.0
 * 4. 0.0
 * 5. Positive real numbers. E.g. 2
 * 6. Infinity
 * 7. NaN
 */
export const compareNumber = (a: number, b: number): number => {
    if (a === 0 && b === 0) {
        // compare -0 and 0
        return compareNumber(1 / a, 1 / b);
    }
    if (Number.isFinite(a) && Number.isFinite(b)) {
        return a - b;
    }
    if (sameNumber(a, b)) return 0;
    if (Number.isNaN(a)) return +1;
    if (Number.isNaN(b)) return -1;
    return a - b;
};

type WithType<S, T extends string> = S extends { readonly type: T } ? S : never;
export type Visitors<State extends { readonly type: string }, R> = {
    [K in State['type']]: (state: WithType<State, K>) => R;
};
export const visitByType = <State extends { readonly type: string }, R>(
    state: State,
    visitors: Visitors<State, R>,
): R => {
    const v = (visitors as Record<string, unknown>)[state.type] as (state: State) => R;
    return v(state);
};

/**
 * Tries to topologically sort the given graph. If the graph contains cycles, `undefined` will be
 * returned.
 */
export const topologicalSort = <T>(
    allNodes: Iterable<T>,
    getOut: (node: T) => Iterable<T>,
): T[] | undefined => {
    // https://en.wikipedia.org/wiki/Topological_sorting#Depth-first_search
    const unmarked = new Set(allNodes);
    const permanentMark = new Set<T>();
    const tempMark = new Set<T>();

    let cyclic = false;
    const result: T[] = [];

    const visit = (node: T): void => {
        if (permanentMark.has(node)) return;
        if (tempMark.has(node)) {
            cyclic = true;
            return;
        }

        unmarked.delete(node);
        tempMark.add(node);
        for (const out of getOut(node)) {
            visit(out);
        }
        tempMark.delete(node);
        permanentMark.add(node);
        result.push(node);
    };

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (!cyclic && unmarked.size > 0) {
        const [first] = unmarked;
        visit(first);
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (cyclic) return undefined;
    return result.reverse();
};

export const isStartingNode = (schema: NodeSchema) => {
    return !schema.inputs.some((i) => i.hasHandle) && schema.outputs.length > 0;
};

export const isEndingNode = (schema: NodeSchema) => {
    return !schema.outputs.some((i) => i.hasHandle) && schema.inputs.length > 0;
};

export const delay = (ms: number): Promise<void> => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

export const mapInputValues = <T>(schema: NodeSchema, getValue: (inputId: InputId) => T): T[] =>
    schema.inputs.map((input) => getValue(input.id));

export const stopPropagation = (event: { readonly stopPropagation: () => void }): void => {
    event.stopPropagation();
};

export const joinEnglish = (list: readonly string[], conj: 'and' | 'or' = 'and'): string => {
    if (list.length === 0) throw new Error('Cannot join empty list');
    if (list.length === 1) return list[0];
    if (list.length === 2) return `${list[0]} ${conj} ${list[1]}`;

    return `${list.slice(0, -1).join(', ')}, ${conj} ${list[list.length - 1]}`;
};

export const capitalize = (string: string): string =>
    string.charAt(0).toUpperCase() + string.slice(1);

export const fixRoundingError = (n: number): number => {
    if (!Number.isFinite(n)) return n;

    const expS = n.toExponential(15);
    if (/0{6}[0-3]\d[eE][+-]\d+$/.test(expS)) {
        return Number(n.toExponential(12));
    }

    if (Number.isInteger(n)) return n;
    const s = String(n);
    if (/(?:9{6}[6-9]|0{6}[0-3])\d$/.test(s)) {
        return Number(n.toPrecision(12));
    }
    return n;
};

export const getInputValue = <T extends NonNullable<InputValue>>(
    inputId: InputId,
    inputData: InputData,
): T | undefined => {
    return (inputData[inputId] ?? undefined) as T | undefined;
};

export const isAutoInput = (input: Input): boolean =>
    input.kind === 'generic' && input.optional && !input.hasHandle;

export const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function groupBy<T, K extends keyof T>(iter: Iterable<T>, key: K): Map<T[K], T[]>;
export function groupBy<T, K>(iter: Iterable<T>, selector: (item: T) => K): Map<K, T[]>;
// eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
export function groupBy<T>(
    iter: Iterable<T>,
    key: keyof T | ((item: T) => unknown),
): Map<unknown, T[]> {
    const map = new Map<unknown, T[]>();

    if (typeof key === 'function') {
        for (const item of iter) {
            const k = key(item);
            let list = map.get(k);
            if (list === undefined) {
                list = [];
                map.set(k, list);
            }
            list.push(item);
        }
    } else {
        for (const item of iter) {
            const k = item[key];
            let list = map.get(k);
            if (list === undefined) {
                list = [];
                map.set(k, list);
            }
            list.push(item);
        }
    }

    return map;
}
