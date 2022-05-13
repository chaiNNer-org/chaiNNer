import { useCallback, useState } from 'react';

/**
 * A variable-length linear edit history.
 *
 * The linear history is stored as a non-empty array with an index pointing to the current value.
 * The history array represents a linear timeline such if value A was before value B in time, then
 * value A will have a smaller index than value B.
 *
 * Additionally, a commit can either be weak or strong. Strong commits simply add their value to
 * the timeline and stay there. Weak commits on the other hand can be overwritten. If another weak
 * commit is made right after a weak commit and has the same id as the previous weak commit, then
 * the previous weak commit will be overwritten. This is useful when certain commits (e.g. of input
 * elements) have the potentially to spam the history.
 */
class EditHistory<T> {
    private readonly history: readonly T[];

    private readonly currentIndex: number;

    readonly maxLength: number;

    readonly weakId: string | undefined;

    get current(): T {
        return this.history[this.currentIndex];
    }

    private constructor(
        history: readonly T[],
        currentIndex: number,
        maxLength: number,
        weakId: string | undefined
    ) {
        if (history.length === 0) {
            throw new Error('Invalid history: History is empty');
        }
        if (currentIndex < 0 || currentIndex >= history.length) {
            throw new Error('Invalid history: Current index out of bounds');
        }
        if (weakId !== undefined && currentIndex !== history.length - 1) {
            throw new Error('Invalid history: Only the last element of the history can be weak.');
        }

        this.history = history;
        this.currentIndex = currentIndex;
        this.maxLength = maxLength;
        this.weakId = weakId;
    }

    static create<T>(initialValue: T, maxLength: number): EditHistory<T> {
        return new EditHistory([initialValue], 0, maxLength, undefined);
    }

    /**
     * Turns any weak commits into strong commits.
     */
    makeStrong(): EditHistory<T> {
        if (this.weakId === undefined) return this;
        return new EditHistory(this.history, this.currentIndex, this.maxLength, undefined);
    }

    undo(): EditHistory<T> {
        if (this.currentIndex === 0) return this.makeStrong();
        return new EditHistory(this.history, this.currentIndex - 1, this.maxLength, undefined);
    }

    redo(): EditHistory<T> {
        if (this.currentIndex === this.history.length - 1) return this.makeStrong();
        return new EditHistory(this.history, this.currentIndex + 1, this.maxLength, undefined);
    }

    private commit(value: T, weakId: string | undefined): EditHistory<T> {
        const start = this.currentIndex + 1 < this.maxLength ? 0 : 1;
        const newHistory = this.history.slice(start, this.currentIndex + 1);
        newHistory.push(value);
        return new EditHistory(newHistory, newHistory.length - 1, this.maxLength, weakId);
    }

    strongCommit(value: T): EditHistory<T> {
        return this.commit(value, undefined);
    }

    weakCommit(value: T, weakId: string): EditHistory<T> {
        if (this.currentIndex === this.history.length - 1 && weakId === this.weakId) {
            // overwrite previous weak commit with the same id
            const newHistory = this.history.slice(0, -1);
            newHistory.push(value);
            return new EditHistory(newHistory, this.currentIndex, this.maxLength, weakId);
        }
        return this.commit(value, weakId);
    }
}

export interface UseEditHistory<T> {
    readonly current: T;
    readonly undo: () => void;
    readonly redo: () => void;
    readonly reset: (value: T) => void;
    readonly strongCommit: (value: T) => void;
    readonly weakCommit: (value: T, id: string) => void;
}

/**
 * The React hook for a variable-length linear history.
 */
export const useEditHistory = <T>(initial: T, maxLength = 100): UseEditHistory<T> => {
    const [history, setHistory] = useState(() => EditHistory.create(initial, maxLength));

    const undo = useCallback(() => setHistory((h) => h.undo()), [setHistory]);
    const redo = useCallback(() => setHistory((h) => h.redo()), [setHistory]);
    const strongCommit = useCallback(
        (value: T) => setHistory((h) => h.strongCommit(value)),
        [setHistory]
    );
    const weakCommit = useCallback(
        (value: T, id: string) => setHistory((h) => h.weakCommit(value, id)),
        [setHistory]
    );
    const reset = useCallback(
        (value: T) => setHistory((h) => EditHistory.create(value, h.maxLength)),
        [setHistory]
    );

    return { current: history.current, strongCommit, weakCommit, undo, redo, reset };
};
