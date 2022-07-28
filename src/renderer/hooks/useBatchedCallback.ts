import { useMemo } from 'react';

/**
 * Returns a batched callback.
 *
 * A batched callback will execute all invocations in order, but it might delay them. The first
 * invocation after `wait` milliseconds will always be executed immediately. All invocations after
 * this first invocation that happen before `wait` milliseconds past will be added to a queue. The
 * queued invocations will be executed `wait` milliseconds after the first invocation.
 */
const getBatchedCallback = <T extends unknown[]>(
    fn: (...args: T) => void,
    wait: number
): ((...arg: T) => void) => {
    let queue: T[] = [];
    let isFirst = true;
    return (...args: T) => {
        if (isFirst) {
            isFirst = false;
            setTimeout(() => {
                isFirst = true;
                const consumedQueue = queue;
                queue = [];

                for (const item of consumedQueue) {
                    fn(...item);
                }
            }, wait);

            fn(...args);
        } else {
            queue.push(args);
        }
    };
};

export const useBatchedCallback = <T extends unknown[]>(
    fn: (...args: T) => void,
    wait: number,
    deps: readonly unknown[]
): ((...args: T) => void) => useMemo(() => getBatchedCallback(fn, wait), deps);
