import { createContext, useContext, useEffect, useState } from 'react';
import { Edge, Node } from 'react-flow-renderer';
import { useThrottledCallback } from 'use-debounce';
import { EdgeData, NodeData, UsableData } from '../../common-types';
import { getBackend } from '../Backend';
import checkNodeValidity from '../checkNodeValidity';
import {
    BackendEventSourceListener,
    useBackendEventSource,
    useBackendEventSourceListener,
} from '../hooks/useBackendEventSource';
import { parseHandle } from '../util';
import { AlertBoxContext, AlertType } from './AlertBoxContext';
import { GlobalContext } from './GlobalNodeState';
import { SettingsContext } from './SettingsContext';

interface ExecutionContextProps {
    run: () => Promise<void>;
    pause: () => Promise<void>;
    kill: () => Promise<void>;
    isRunning: boolean;
}

const convertToUsableFormat = (
    nodes: readonly Node<NodeData>[],
    edges: readonly Edge<EdgeData>[]
) => {
    const result: Record<string, UsableData> = {};

    // Set up each node in the result
    nodes.forEach((element) => {
        const { id, data, type: nodeType } = element;
        const { schemaId } = data;
        // Node
        result[id] = {
            schemaId,
            id,
            inputs: {},
            outputs: {},
            child: false,
            nodeType,
        };
        if (nodeType === 'iterator') {
            result[id].children = [];
            result[id].percent = data.percentComplete || 0;
        }
    });

    // Apply input data to inputs when applicable
    nodes.forEach((node) => {
        const { inputData } = node.data;
        Object.keys(inputData)
            .map(Number)
            .forEach((index) => {
                result[node.id].inputs[index] = inputData[index];
            });
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

    // Convert inputs and outputs to arrays
    Object.keys(result).forEach((id) => {
        result[id].inputs = Object.values(result[id].inputs);
        result[id].outputs = Object.values(result[id].outputs);
    });

    return result;
};

export const ExecutionContext = createContext<Readonly<ExecutionContextProps>>(
    {} as ExecutionContextProps
);

// eslint-disable-next-line @typescript-eslint/ban-types
export const ExecutionProvider = ({ children }: React.PropsWithChildren<{}>) => {
    const { useAnimateEdges, nodes, edges, schemata, setIteratorPercent } =
        useContext(GlobalContext);

    const { useIsCpu, useIsFp16, port } = useContext(SettingsContext);

    const { showMessageBox } = useContext(AlertBoxContext);

    const [isCpu] = useIsCpu;
    const [isFp16] = useIsFp16;

    const [animateEdges, unAnimateEdges, completeEdges, clearCompleteEdges] = useAnimateEdges();

    const [isRunning, setIsRunning] = useState(false);
    const backend = getBackend(port);

    useEffect(() => {
        // TODO: Actually fix this so it un-animates correctly
        setTimeout(() => {
            if (!isRunning) {
                unAnimateEdges();
            }
        }, 1000);
    }, [isRunning]);

    const [eventSource, eventSourceStatus] = useBackendEventSource(port);

    useBackendEventSourceListener(
        eventSource,
        'finish',
        () => {
            clearCompleteEdges();
            setIsRunning(false);
        },
        [setIsRunning, clearCompleteEdges]
    );

    useBackendEventSourceListener(
        eventSource,
        'execution-error',
        (data) => {
            if (data) {
                showMessageBox(AlertType.ERROR, null, data.exception);
                unAnimateEdges();
                setIsRunning(false);
            }
        },
        [setIsRunning, unAnimateEdges]
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
            if (runningNodes && isRunning) {
                animateEdges(runningNodes);
            } else if (!isRunning) {
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
        if (eventSourceStatus === 'error') {
            showMessageBox(
                AlertType.ERROR,
                null,
                'An unexpected error occurred. You may need to restart chaiNNer.'
            );
            unAnimateEdges();
            setIsRunning(false);
        }
    }, [eventSourceStatus]);

    const run = async () => {
        setIsRunning(true);
        animateEdges();
        if (nodes.length === 0) {
            showMessageBox(AlertType.ERROR, null, 'There are no nodes to run.');
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
                showMessageBox(
                    AlertType.ERROR,
                    null,
                    `There are invalid nodes in the editor. Please fix them before running.\n${reasons}`
                );
                unAnimateEdges();
                setIsRunning(false);
                return;
            }
            try {
                const data = convertToUsableFormat(nodes, edges);
                const response = await backend.run({
                    data,
                    isCpu,
                    isFp16: isFp16 && !isCpu,
                });
                if (response.exception) {
                    showMessageBox(AlertType.ERROR, null, response.exception);
                    unAnimateEdges();
                    setIsRunning(false);
                }
            } catch (err) {
                showMessageBox(AlertType.ERROR, null, 'An unexpected error occurred.');
                unAnimateEdges();
                setIsRunning(false);
            }
        }
    };

    const pause = async () => {
        try {
            const response = await backend.pause();
            if (response.exception) {
                showMessageBox(AlertType.ERROR, null, response.exception);
            }
        } catch (err) {
            showMessageBox(AlertType.ERROR, null, 'An unexpected error occurred.');
        }
        setIsRunning(false);
        unAnimateEdges();
    };

    const kill = async () => {
        try {
            const response = await backend.kill();
            clearCompleteEdges();
            if (response.exception) {
                showMessageBox(AlertType.ERROR, null, response.exception);
            }
        } catch (err) {
            showMessageBox(AlertType.ERROR, null, 'An unexpected error occurred.');
        }
        unAnimateEdges();
        setIsRunning(false);
    };

    return (
        <ExecutionContext.Provider value={{ run, pause, kill, isRunning }}>
            {children}
        </ExecutionContext.Provider>
    );
};
