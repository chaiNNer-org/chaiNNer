import { useMemo } from 'react';

/**
 * Returns a batched callback.
 *
 * A batched callback will execute all invocations in order, but it might delay them. The first
 * invocation after `wait` milliseconds will always be executed immediately. All invocations after
 * this first invocation that happen before `wait` milliseconds past will be added to a queue. The
 * queued invocations will be executed `wait` milliseconds after the first invocation.
 */
export const batchedCallback = <T extends unknown[]>(
    fn: (...args: T) => void,
    wait: number
): ((...arg: T) => void) => {
    let queue: T[] = [];
    let lastCall = Date.now();
    let isFirst = true;
    return (...args: T) => {
        if (isFirst) {
            isFirst = false;
            setTimeout(() => {
                isFirst = true;
                if (queue.length === 0) return;
                const consumedQueue = queue;
                queue = [];

                for (const item of consumedQueue) {
                    fn(...item);
                }
                lastCall = Date.now();
            }, wait);

            const current = Date.now();
            if (current - lastCall > wait) {
                lastCall = current;
                fn(...args);
            } else {
                queue.push(args);
            }
        } else {
            queue.push(args);
        }
    };
};

export const useBatchedCallback = <T extends unknown[]>(
    fn: (...args: T) => void,
    wait: number
): ((...arg: T) => void) => {
    return useMemo(() => batchedCallback(fn, wait), [fn, wait]);
};
