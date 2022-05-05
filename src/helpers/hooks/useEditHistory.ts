/* eslint-disable import/prefer-default-export */
import { useCallback, useState } from 'react';

/**
 * A variable-length linear edit history.
 *
 * The linear history is stored as a non-empty array with an index pointing to the current value.
 * The history array represents a linear timeline such if value A was before value B in time, then
 * value A will have a smaller index than value B.
 */
class EditHistory<T> {
    private readonly history: readonly T[];

    private readonly currentIndex: number;

    readonly maxLength: number;

    get current(): T {
        return this.history[this.currentIndex];
    }

    private constructor(history: readonly T[], currentIndex: number, maxLength: number) {
        if (history.length === 0) {
            throw new Error('Invalid history: History is empty');
        }
        if (currentIndex < 0 || currentIndex >= history.length) {
            throw new Error('Invalid history: Current index out of bounds');
        }

        this.history = history;
        this.currentIndex = currentIndex;
        this.maxLength = maxLength;
    }

    static create<T>(initialValue: T, maxLength: number): EditHistory<T> {
        return new EditHistory([initialValue], 0, maxLength);
    }

    undo(): EditHistory<T> {
        if (this.currentIndex === 0) return this;
        return new EditHistory(this.history, this.currentIndex - 1, this.maxLength);
    }

    redo(): EditHistory<T> {
        if (this.currentIndex === this.history.length - 1) return this;
        return new EditHistory(this.history, this.currentIndex + 1, this.maxLength);
    }

    commit(value: T): EditHistory<T> {
        const start = this.currentIndex + 1 < this.maxLength ? 0 : 1;
        const newHistory = this.history.slice(start, this.currentIndex + 1);
        newHistory.push(value);
        return new EditHistory(newHistory, newHistory.length - 1, this.maxLength);
    }
}

/**
 * The React hook for a simple variable-length linear history.
 */
export const useEditHistory = <T>(initial: T, maxLength = 100) => {
    const [history, setHistory] = useState(() => EditHistory.create(initial, maxLength));

    const undo = useCallback(() => setHistory((h) => h.undo()), [setHistory]);
    const redo = useCallback(() => setHistory((h) => h.redo()), [setHistory]);
    const commit = useCallback((value: T) => setHistory((h) => h.commit(value)), [setHistory]);
    const reset = useCallback(
        (value: T) => setHistory((h) => EditHistory.create(value, h.maxLength)),
        [setHistory]
    );

    return [history.current, commit, undo, redo, reset] as const;
};
