import { useCallback, useRef, useState } from 'react';

export type ChangeCounter = number & { __changeCounter: true };

export const nextChangeCount = (count: number): number => (count + 1) % 1_000_000;

export const useChangeCounter = () => {
    const [counter, setCounter] = useState(0);
    const counterRef = useRef(0);

    const change = useCallback(() => {
        // we have to wrap at some point, so I just arbitrarily chose 1 million
        setCounter((prev) => {
            const newValue = nextChangeCount(prev);
            counterRef.current = newValue;
            return newValue;
        });
    }, [setCounter]);

    return [counter as ChangeCounter, change, counterRef] as const;
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
export const wrapRefChanges = <T>(
    setter: Readonly<React.MutableRefObject<React.Dispatch<React.SetStateAction<T>>>>,
    addChange: () => void
): React.Dispatch<React.SetStateAction<T>> => {
    return (value) => {
        setter.current(value);
        addChange();
    };
};
