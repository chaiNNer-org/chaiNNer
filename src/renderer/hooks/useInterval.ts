import { useEffect } from 'react';

/**
 * Executes the given effect indefinitely every `delay` ms.
 *
 * The interval gets reset every time the callback changes.
 */
export const useInterval = (callback: () => void, delay: number) => {
    useEffect(() => {
        const id = setInterval(callback, delay);
        return () => clearInterval(id);
    }, [delay, callback]);
};
