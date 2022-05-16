import { useEffect, useState } from 'react';
import { Edge, Node, useReactFlow } from 'react-flow-renderer';
import { createContext, useContext } from 'use-context-selector';
import { useThrottledCallback } from 'use-debounce';
import { EdgeData, NodeData, UsableData } from '../../common-types';
import { getBackend } from '../Backend';
import checkNodeValidity from '../checkNodeValidity';
import {
    BackendEventSourceListener,
    useBackendEventSource,
    useBackendEventSourceListener,
} from '../hooks/useBackendEventSource';
import { ipcRenderer } from '../safeIpc';
import { SchemaMap } from '../SchemaMap';
import { parseHandle } from '../util';
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

    // Set up each node in the result
    nodes.forEach((element) => {
        const { id, data, type: nodeType } = element;
        const { schemaId, inputData } = data;
        const schema = schemata.get(schemaId);

        // Node
        result[id] = {
            schemaId,
            id,
            inputs: Array.from({ length: schema.inputs.length }, (_, i) => inputData[i] ?? null),
            outputs: [],
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

    // Apply inputs and outputs from connections
    // Note: As-is, this will overwrite inputted data from above
    edges.forEach((element) => {
        const { sourceHandle, targetHandle, source, target } = element;
        // Connection
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (result[source] && result[target] && sourceHandle && targetHandle) {
            result[source].outputs[parseHandle(sourceHandle).index] = { id: targetHandle };
            result[target].inputs[parseHandle(targetHandle).index] = { id: sourceHandle };
        }
    });

    return result;
};

export const ExecutionContext = createContext<Readonly<ExecutionContextValue>>(
    {} as ExecutionContextValue
);

// eslint-disable-next-line @typescript-eslint/ban-types
export const ExecutionProvider = ({ children }: React.PropsWithChildren<{}>) => {
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

    useEffect(() => {
        if (!isBackendKilled && eventSourceStatus === 'error') {
            sendAlert(
                AlertType.ERROR,
                null,
                'An unexpected error occurred. You may need to restart chaiNNer.'
            );
            unAnimateEdges();
            setStatus(ExecutionStatus.READY);
        }
    }, [eventSourceStatus, unAnimateEdges, isBackendKilled]);

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
                    isFp16: isFp16 && !isCpu,
                });
                if (response.exception) {
                    sendAlert(AlertType.ERROR, null, response.exception);
                    unAnimateEdges();
                    setStatus(ExecutionStatus.READY);
                }
            } catch (err) {
                sendAlert(AlertType.ERROR, null, 'An unexpected error occurred.');
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

    return (
        <ExecutionContext.Provider
            value={{ run, pause, kill, status, isBackendKilled, setIsBackendKilled }}
        >
            {children}
        </ExecutionContext.Provider>
    );
};
