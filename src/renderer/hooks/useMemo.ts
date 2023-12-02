import { useMemo } from 'react';

/**
 * A `useMemo` variant that compares the array items for reference equality.
 */
export const useMemoArray = <T extends readonly unknown[]>(array: T): T =>
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useMemo(() => array, array);

/**
 * A `useMemo` variant that compares the object values (using `Object.values`) for reference
 * equality.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useMemoObject = <T extends Readonly<Record<string | number, any>>>(
    obj: T,
    // eslint-disable-next-line react-hooks/exhaustive-deps
): Readonly<T> => useMemo(() => obj, Object.values(obj));
