import { memo, useEffect, useMemo, useState } from 'react';
import { Edge, Node, useReactFlow } from 'react-flow-renderer';
import { createContext, useContext } from 'use-context-selector';
import { useThrottledCallback } from 'use-debounce';
import { getBackend } from '../../common/Backend';
import { EdgeData, EdgeHandle, NodeData, UsableData } from '../../common/common-types';
import { ipcRenderer } from '../../common/safeIpc';
import { SchemaMap } from '../../common/SchemaMap';
import { ParsedHandle, parseHandle } from '../../common/util';
import checkNodeValidity from '../helpers/checkNodeValidity';
import { useAsyncEffect } from '../hooks/useAsyncEffect';
import {
    BackendEventSourceListener,
    useBackendEventSource,
    useBackendEventSourceListener,
} from '../hooks/useBackendEventSource';
import { AlertBoxContext, AlertType } from './AlertBoxContext';
import { GlobalContext } from './GlobalNodeState';
import { SettingsContext } from './SettingsContext';

export enum ExecutionStatus {
    READY,
    RUNNING,
    PAUSED,
}

interface ExecutionContextValue {
    run: () => Promise<void>;
    pause: () => Promise<void>;
    kill: () => Promise<void>;
    status: ExecutionStatus;
    isBackendKilled: boolean;
    setIsBackendKilled: React.Dispatch<React.SetStateAction<boolean>>;
}

const convertToUsableFormat = (
    nodes: readonly Node<NodeData>[],
    edges: readonly Edge<EdgeData>[],
    schemata: SchemaMap
) => {
    const result: Record<string, UsableData> = {};

    const nodeSchemaMap = new Map(nodes.map((n) => [n.id, schemata.get(n.data.schemaId)]));
    const convertHandle = (handle: ParsedHandle, type: 'input' | 'output'): EdgeHandle => {
        const schema = nodeSchemaMap.get(handle.nodeId);
        if (!schema) {
            throw new Error(`Invalid handle: The node id ${handle.nodeId} is not valid`);
        }

        const index = schema[`${type}s`].findIndex((inOut) => inOut.id === handle.inOutId);
        if (index === -1) {
            throw new Error(
                `Invalid handle: There is no ${type} with id ${handle.inOutId} in ${schema.name}`
            );
        }

        return { id: handle.nodeId, index };
    };

    type Handles = Record<string, Record<number, EdgeHandle | undefined> | undefined>;
    const inputHandles: Handles = {};
    const outputHandles: Handles = {};
    edges.forEach((element) => {
        const { sourceHandle, targetHandle } = element;
        if (!sourceHandle || !targetHandle) return;

        const sourceH = parseHandle(sourceHandle);
        const targetH = parseHandle(targetHandle);

        (inputHandles[targetH.nodeId] ??= {})[targetH.inOutId] = convertHandle(sourceH, 'output');
        (outputHandles[sourceH.nodeId] ??= {})[sourceH.inOutId] = convertHandle(targetH, 'input');
    });

    // Set up each node in the result
    nodes.forEach((element) => {
        const { id, data, type: nodeType } = element;
        const { schemaId, inputData } = data;
        const schema = schemata.get(schemaId);

        // Node
        result[id] = {
            schemaId,
            id,
            inputs: schema.inputs.map(
                (input) => inputHandles[id]?.[input.id] ?? inputData[input.id] ?? null
            ),
            outputs: schema.outputs.map((output) => outputHandles[id]?.[output.id] ?? null),
            child: false,
            nodeType,
        };
        if (nodeType === 'iterator') {
            result[id].children = [];
            result[id].percent = data.percentComplete || 0;
        }
    });

    // set children
    nodes.forEach((node) => {
        if (node.parentNode) {
            result[node.parentNode].children!.push(node.id);
            result[node.id].child = true;
        }
    });

    return result;
};

export const ExecutionContext = createContext<Readonly<ExecutionContextValue>>(
    {} as ExecutionContextValue
);

// eslint-disable-next-line @typescript-eslint/ban-types
export const ExecutionProvider = memo(({ children }: React.PropsWithChildren<{}>) => {
    const { schemata, useAnimateEdges, setIteratorPercent } = useContext(GlobalContext);
    const { useIsCpu, useIsFp16, port } = useContext(SettingsContext);
    const { sendAlert } = useContext(AlertBoxContext);

    const [isCpu] = useIsCpu;
    const [isFp16] = useIsFp16;

    const [animateEdges, unAnimateEdges, completeEdges, clearCompleteEdges] = useAnimateEdges();

    const { getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();

    const [status, setStatus] = useState(ExecutionStatus.READY);
    const backend = getBackend(port);

    const [isBackendKilled, setIsBackendKilled] = useState(false);

    useEffect(() => {
        // TODO: Actually fix this so it un-animates correctly
        const id = setTimeout(() => {
            if (status !== ExecutionStatus.RUNNING) {
                unAnimateEdges();
            }
        }, 1000);
        return () => clearTimeout(id);
    }, [status, unAnimateEdges]);

    useEffect(() => {
        if (status === ExecutionStatus.RUNNING) {
            ipcRenderer.send('start-sleep-blocker');
        } else {
            ipcRenderer.send('stop-sleep-blocker');
        }
    }, [status]);

    const [eventSource, eventSourceStatus] = useBackendEventSource(port);

    useBackendEventSourceListener(
        eventSource,
        'finish',
        () => {
            clearCompleteEdges();
            setStatus(ExecutionStatus.READY);
        },
        [setStatus, clearCompleteEdges]
    );

    useBackendEventSourceListener(
        eventSource,
        'execution-error',
        (data) => {
            if (data) {
                sendAlert(AlertType.ERROR, null, data.exception);
                unAnimateEdges();
                setStatus(ExecutionStatus.READY);
            }
        },
        [setStatus, unAnimateEdges]
    );

    const updateNodeFinish = useThrottledCallback<BackendEventSourceListener<'node-finish'>>(
        (data) => {
            if (data) {
                completeEdges(data.finished);
            }
        },
        350
    );
    useBackendEventSourceListener(eventSource, 'node-finish', updateNodeFinish, [
        completeEdges,
        updateNodeFinish,
    ]);

    const updateIteratorProgress = useThrottledCallback<
        BackendEventSourceListener<'iterator-progress-update'>
    >((data) => {
        if (data) {
            const { percent, iteratorId, running: runningNodes } = data;
            if (runningNodes && status === ExecutionStatus.RUNNING) {
                animateEdges(runningNodes);
            } else if (status !== ExecutionStatus.RUNNING) {
                unAnimateEdges();
            }
            setIteratorPercent(iteratorId, percent);
        }
    }, 350);
    useBackendEventSourceListener(eventSource, 'iterator-progress-update', updateIteratorProgress, [
        animateEdges,
        updateIteratorProgress,
    ]);

    const [ownsBackend, setOwnsBackend] = useState(true);
    useAsyncEffect(
        {
            supplier: () => ipcRenderer.invoke('owns-backend'),
            successEffect: setOwnsBackend,
        },
        [setOwnsBackend]
    );

    useEffect(() => {
        if (ownsBackend && !isBackendKilled && eventSourceStatus === 'error') {
            sendAlert(
                AlertType.ERROR,
                null,
                'An unexpected error occurred. You may need to restart chaiNNer.'
            );
            unAnimateEdges();
            setStatus(ExecutionStatus.READY);
        }
    }, [eventSourceStatus, unAnimateEdges, isBackendKilled, ownsBackend]);

    const run = async () => {
        const nodes = getNodes();
        const edges = getEdges();

        setStatus(ExecutionStatus.RUNNING);
        animateEdges();
        if (nodes.length === 0) {
            sendAlert(AlertType.ERROR, null, 'There are no nodes to run.');
            unAnimateEdges();
            setStatus(ExecutionStatus.READY);
        } else {
            const nodeValidities = nodes.map((node) => {
                const { inputs, category, name } = schemata.get(node.data.schemaId);
                return [
                    ...checkNodeValidity({
                        id: node.id,
                        inputData: node.data.inputData,
                        edges,
                        inputs,
                    }),
                    `${category}: ${name}`,
                ] as const;
            });
            const invalidNodes = nodeValidities.filter(([isValid]) => !isValid);
            if (invalidNodes.length > 0) {
                const reasons = invalidNodes
                    .map(([, reason, type]) => `• ${type}: ${reason}`)
                    .join('\n');
                sendAlert(
                    AlertType.ERROR,
                    null,
                    `There are invalid nodes in the editor. Please fix them before running.\n${reasons}`
                );
                unAnimateEdges();
                setStatus(ExecutionStatus.READY);
                return;
            }
            try {
                const data = convertToUsableFormat(nodes, edges, schemata);
                const response = await backend.run({
                    data,
                    isCpu,
                    isFp16,
                });
                if (response.exception) {
                    sendAlert(AlertType.ERROR, null, response.exception);
                    unAnimateEdges();
                    setStatus(ExecutionStatus.READY);
                }
            } catch (err: unknown) {
                sendAlert(AlertType.ERROR, null, `An unexpected error occurred: ${String(err)}`);
                unAnimateEdges();
                setStatus(ExecutionStatus.READY);
            }
        }
    };

    const pause = async () => {
        try {
            const response = await backend.pause();
            if (response.exception) {
                sendAlert(AlertType.ERROR, null, response.exception);
            }
        } catch (err) {
            sendAlert(AlertType.ERROR, null, 'An unexpected error occurred.');
        }
        setStatus(ExecutionStatus.PAUSED);
        unAnimateEdges();
    };

    const kill = async () => {
        try {
            const response = await backend.kill();
            clearCompleteEdges();
            if (response.exception) {
                sendAlert(AlertType.ERROR, null, response.exception);
            }
        } catch (err) {
            sendAlert(AlertType.ERROR, null, 'An unexpected error occurred.');
        }
        unAnimateEdges();
        setStatus(ExecutionStatus.READY);
    };

    // eslint-disable-next-line react/jsx-no-constructed-context-values
    let value = { run, pause, kill, status, isBackendKilled, setIsBackendKilled };
    value = useMemo(() => value, Object.values(value));

    return <ExecutionContext.Provider value={value}>{children}</ExecutionContext.Provider>;
});
