import { useState, useCallback } from 'react';

export type ChangeCounter = number & { __changeCounter: true };

export const useChangeCounter = () => {
    const [counter, setCounter] = useState(0);

    const change = useCallback(() => {
        // we have to warp at some point, so I just arbitrarily chose 1 million
        setCounter((prev) => (prev + 1) % 1_000_000);
    }, [setCounter]);

    return [counter as ChangeCounter, change] as const;
};

export const wrapChanges = <T>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    addChange: () => void
): React.Dispatch<React.SetStateAction<T>> => {
    return (value) => {
        setter(value);
        addChange();
    };
};
