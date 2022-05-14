import { useCallback, useEffect, useState } from 'react';
import { Edge, Node, useReactFlow, Viewport } from 'react-flow-renderer';
import { useContext, useContextSelector } from 'use-context-selector';
import { EdgeData, NodeData } from '../common-types';
import { GlobalContext, GlobalVolatileContext } from '../helpers/contexts/GlobalNodeState';
import { useIpcRendererListener } from '../helpers/hooks/useIpcRendererListener';
import { noop } from '../helpers/util';

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

type HistoryState = readonly [Node<NodeData>[], Edge<EdgeData>[], Viewport];

// eslint-disable-next-line import/prefer-default-export
export const HistoryProvider = ({ children }: React.PropsWithChildren<unknown>): JSX.Element => {
    const changeId = useContextSelector(
        GlobalVolatileContext,
        (c) => `${c.nodeChanges},${c.edgeChanges}`
    );
    const { changeNodes, changeEdges } = useContext(GlobalContext);
    const { getNodes, getEdges, getViewport, setViewport } = useReactFlow();

    const [historyObj] = useState<{ history: EditHistory<HistoryState> }>(() => {
        const initial: HistoryState = [getNodes(), getEdges(), getViewport()];
        return { history: EditHistory.create(initial, 100) };
    });

    const [selfUpdate, setSelfUpdate] = useState(false);
    useEffect(() => {
        if (!selfUpdate) return noop;

        const id = setTimeout(() => {
            setSelfUpdate(false);
        }, 50);
        return () => clearTimeout(id);
    }, [selfUpdate, setSelfUpdate]);

    const apply = useCallback(
        ([nodes, edges, viewport]: HistoryState) => {
            setSelfUpdate(true);
            changeNodes(nodes);
            changeEdges(edges);
            setViewport({ ...viewport });
        },
        [setSelfUpdate, changeNodes, changeEdges, setViewport]
    );

    // commit to history
    useEffect(() => {
        if (selfUpdate) return noop;

        const id = setTimeout(() => {
            historyObj.history = historyObj.history.commit([getNodes(), getEdges(), getViewport()]);
        }, 200);
        return () => clearTimeout(id);
    }, [changeId]);

    useIpcRendererListener(
        'history-undo',
        () => {
            historyObj.history = historyObj.history.undo();
            apply(historyObj.history.current);
        },
        [apply]
    );

    useIpcRendererListener(
        'history-redo',
        () => {
            historyObj.history = historyObj.history.redo();
            apply(historyObj.history.current);
        },
        [apply]
    );

    return <>{children}</>;
};
