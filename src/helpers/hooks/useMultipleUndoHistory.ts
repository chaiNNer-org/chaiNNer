import { useState } from 'react';

const useUndoHistory = <T>(maxLength: number) => {
    const [previous, setPrevious] = useState<readonly T[]>([]);
    const [current, setCurrent] = useState<T | null>(null);
    const [next, setNext] = useState<readonly T[]>([]);

    const undo = () => {
        if (previous.length > 0) {
            setNext([...next, current!]);
            setCurrent(previous[previous.length - 1]);
            setPrevious(previous.slice(0, -1));
        }
    };

    const redo = () => {
        if (next.length > 0) {
            setPrevious([...previous, current!]);
            setCurrent(next[next.length - 1]);
            setNext(next.slice(0, -1));
        }
    };

    const push = (data: T) => {
        if (data !== current) {
            if (next.length) {
                setNext([]);
            }
            if (current) {
                if (previous.length) {
                    setPrevious([...previous, current].slice(-maxLength));
                } else {
                    setPrevious([current]);
                }
            }
            setCurrent(data);
        }
    };

    return [undo, redo, push, current] as const;
};

export default useUndoHistory;
