import { useCallback, useEffect, useMemo, useRef } from 'react';

export interface EventBacklog<T> {
    readonly push: (event: T) => void;
    readonly processAll: () => void;
}

export interface BacklogOption<T> {
    process: (event: T[]) => void;
    interval: number;
}

export const useEventBacklog = <T>({ process, interval }: BacklogOption<T>): EventBacklog<T> => {
    const backlogRef = useRef<T[]>([]);
    const push = useCallback((event: T): void => {
        backlogRef.current.push(event);
    }, []);

    const processRef = useRef(process);
    useEffect(() => {
        processRef.current = process;
    }, [process]);

    const processAll = useCallback(() => {
        if (backlogRef.current.length > 0) {
            const backlog = backlogRef.current;
            backlogRef.current = [];
            processRef.current(backlog);
        }
    }, []);

    useEffect(() => {
        const timeout = setInterval(processAll, interval);
        return () => clearInterval(timeout);
    }, [processAll, interval]);

    return useMemo(() => ({ push, processAll }), [push, processAll]);
};
