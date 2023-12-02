import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Edge, Node, useReactFlow } from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { EdgeData, NodeData } from '../../common/common-types';
import { noop } from '../../common/util';
import { GlobalContext, GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { useHotkeys } from '../hooks/useHotkeys';
import { useIpcRendererListener } from '../hooks/useIpcRendererListener';

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

type HistoryState = readonly [Node<NodeData>[], Edge<EdgeData>[]];

export const HistoryProvider = memo(
    ({ children }: React.PropsWithChildren<unknown>): JSX.Element => {
        const changeId = useContextSelector(
            GlobalVolatileContext,
            (c) => `${c.nodeChanges},${c.edgeChanges}`,
        );
        const { changeNodes, changeEdges } = useContext(GlobalContext);
        const { getNodes, getEdges } = useReactFlow();

        // eslint-disable-next-line react/hook-use-state
        const [initialValue] = useState(() => {
            const initial: HistoryState = [getNodes(), getEdges()];
            return EditHistory.create(initial, 100);
        });
        const historyRef = useRef(initialValue);

        const [selfUpdate, setSelfUpdate] = useState(false);
        useEffect(() => {
            if (!selfUpdate) return noop;

            const id = setTimeout(() => {
                setSelfUpdate(false);
            }, 50);
            return () => clearTimeout(id);
        }, [selfUpdate, setSelfUpdate]);

        const apply = useCallback(
            ([nodes, edges]: HistoryState) => {
                setSelfUpdate(true);
                changeNodes(nodes);
                changeEdges(edges);
            },
            [setSelfUpdate, changeNodes, changeEdges],
        );

        // commit to history
        useEffect(() => {
            if (selfUpdate) return noop;

            const id = setTimeout(() => {
                historyRef.current = historyRef.current.commit([getNodes(), getEdges()]);
            }, 250);
            return () => clearTimeout(id);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [changeId]);

        const undo = useCallback(() => {
            historyRef.current = historyRef.current.undo();
            apply(historyRef.current.current);
        }, [apply]);
        const redo = useCallback(() => {
            historyRef.current = historyRef.current.redo();
            apply(historyRef.current.current);
        }, [apply]);

        useIpcRendererListener('history-undo', undo);
        useIpcRendererListener('history-redo', redo);
        useHotkeys('ctrl+z, cmd+z', undo);
        useHotkeys('ctrl+y, cmd+y, ctrl+shift+z, cmd+shift+z', redo);

        // eslint-disable-next-line react/jsx-no-useless-fragment
        return <>{children}</>;
    },
);
