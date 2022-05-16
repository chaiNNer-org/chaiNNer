import { useEffect, useState } from 'react';
import { UseAsyncEffectOptions, useAsyncEffect } from './useAsyncEffect';

export const useInterval = (
    callback: () => void,
    delay: number,
    dependencies: readonly unknown[] = []
) => {
    useEffect(() => {
        const id = setInterval(callback, delay);
        return () => clearInterval(id);
    }, [delay, ...dependencies]);
};

/**
 * Executes the given async effect indefinitely every `delay` ms.
 *
 * If the async effect takes longer than `delay` ms to execute, it will be canceled.
 */
export const useAsyncInterval = <T>(
    options: UseAsyncEffectOptions<T>,
    delay: number,
    dependencies: readonly unknown[] = []
) => {
    const [counter, setCounter] = useState(0);

    useInterval(() => setCounter((prev) => (prev + 1) % 1000), delay, dependencies);

    useAsyncEffect(options, [counter]);
};
