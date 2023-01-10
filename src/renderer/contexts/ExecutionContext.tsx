import log from 'electron-log';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Edge, Node, useReactFlow } from 'reactflow';
import { createContext, useContext, useContextSelector } from 'use-context-selector';
import { useThrottledCallback } from 'use-debounce';
import { checkNodeValidity } from '../../common/checkNodeValidity';
import {
    EdgeData,
    InputId,
    JsonEdgeInput,
    JsonInput,
    JsonNode,
    NodeData,
    OutputId,
} from '../../common/common-types';
import { ipcRenderer } from '../../common/safeIpc';
import { SchemaMap } from '../../common/SchemaMap';
import {
    ParsedSourceHandle,
    assertNever,
    getInputValues,
    parseSourceHandle,
    parseTargetHandle,
} from '../../common/util';
import { getConnectedInputs } from '../helpers/connectedInputs';
import { getEffectivelyDisabledNodes } from '../helpers/disabled';
import { getNodesWithSideEffects } from '../helpers/sideEffect';
import {
    BackendEventMap,
    BackendEventSourceListener,
    useBackendEventSource,
    useBackendEventSourceListener,
} from '../hooks/useBackendEventSource';
import { useBackendExecutionOptions } from '../hooks/useBackendExecutionOptions';
import { useBatchedCallback } from '../hooks/useBatchedCallback';
import { useHotkeys } from '../hooks/useHotkeys';
import { useMemoObject } from '../hooks/useMemo';
import { AlertBoxContext, AlertType } from './AlertBoxContext';
import { BackendContext } from './BackendContext';
import { GlobalContext, GlobalVolatileContext } from './GlobalNodeState';

export enum ExecutionStatus {
    READY,
    RUNNING,
    PAUSED,
}

interface ExecutionStatusContextValue {
    status: ExecutionStatus;
    paused: boolean;
}

interface ExecutionContextValue {
    run: () => Promise<void>;
    pause: () => Promise<void>;
    kill: () => Promise<void>;
    status: ExecutionStatus;
}

export const ExecutionStatusContext = createContext<Readonly<ExecutionStatusContextValue>>({
    status: ExecutionStatus.READY,
    paused: false,
});

export const ExecutionContext = createContext<Readonly<ExecutionContextValue>>(
    {} as ExecutionContextValue
);

const convertToUsableFormat = (
    nodes: readonly Node<NodeData>[],
    edges: readonly Edge<EdgeData>[],
    schemata: SchemaMap
) => {
    const result: JsonNode[] = [];

    const nodeSchemaMap = new Map(nodes.map((n) => [n.id, schemata.get(n.data.schemaId)]));
    const convertHandle = (handle: ParsedSourceHandle): JsonEdgeInput => {
        const schema = nodeSchemaMap.get(handle.nodeId);
        if (!schema) {
            throw new Error(`Invalid handle: The node id ${handle.nodeId} is not valid`);
        }

        const index = schema.outputs.findIndex((inOut) => inOut.id === handle.outputId);
        if (index === -1) {
            throw new Error(
                `Invalid handle: There is no output with id ${handle.outputId} in ${schema.name}`
            );
        }

        return { type: 'edge', id: handle.nodeId, index };
    };

    type Handles<I extends InputId | OutputId> = Record<
        string,
        Record<I, JsonEdgeInput | undefined> | undefined
    >;
    const inputHandles: Handles<InputId> = {};
    edges.forEach((element) => {
        const { sourceHandle, targetHandle } = element;
        if (!sourceHandle || !targetHandle) return;

        const sourceH = parseSourceHandle(sourceHandle);
        const targetH = parseTargetHandle(targetHandle);

        (inputHandles[targetH.nodeId] ??= {})[targetH.inputId] = convertHandle(sourceH);
    });

    // Set up each node in the result
    nodes.forEach((element) => {
        const { id, data, type: nodeType } = element;
        const { schemaId, inputData } = data;
        const schema = schemata.get(schemaId);

        if (!nodeType) {
            throw new Error(
                `Expected all nodes to have a node type, but ${schema.name} (id: ${schemaId}) node did not.`
            );
        }

        // Node
        result.push({
            id,
            schemaId,
            inputs: getInputValues<JsonInput>(
                schema,
                (inputId) =>
                    inputHandles[id]?.[inputId] ?? {
                        type: 'value',
                        value: inputData[inputId] ?? null,
                    }
            ),
            nodeType,
            parent: element.parentNode ?? null,
        });
    });

    return result;
};

const getExecutionErrorMessage = (
    { exception, source }: BackendEventMap['execution-error'],
    schemata: SchemaMap
): string => {
    if (!source) return exception;

    const schema = schemata.get(source.schemaId);
    let { name } = schema;
    if (schemata.schemata.filter((s) => s.name === name).length > 1) {
        // make the name unique using the category of the schema
        name = `${schema.category} ${schema.name}`;
    }

    const inputs = schema.inputs.flatMap((i) => {
        const value = source.inputs[i.id];
        if (value === undefined) return [];

        let valueStr: string;
        const option = i.kind === 'dropdown' && i.options.find((o) => o.value === value);
        if (option) {
            valueStr = option.option;
        } else if (value === null) {
            valueStr = 'None';
        } else if (typeof value === 'number') {
            valueStr = String(value);
        } else if (typeof value === 'string') {
            valueStr = JSON.stringify(value);
        } else {
            let type = 'Image';
            if (value.channels === 1) type = 'Grayscale image';
            if (value.channels === 3) type = 'RGB image';
            if (value.channels === 4) type = 'RGBA image';
            valueStr = `${type} ${value.width}x${value.height}`;
        }

        return [`• ${i.label}: ${valueStr}`];
    });
    const partial = inputs.length === schema.inputs.length;
    const inputsInfo =
        inputs.length === 0
            ? ''
            : `Input values${partial ? '' : ' (partial)'}:\n${inputs.join('\n')}`;

    return `An error occurred in a ${name} node:\n\n${exception.trim()}\n\n${inputsInfo}`;
};

// eslint-disable-next-line @typescript-eslint/ban-types
export const ExecutionProvider = memo(({ children }: React.PropsWithChildren<{}>) => {
    const {
        animate,
        unAnimate,
        setIteratorPercent,
        typeStateRef,
        outputDataActions,
        getInputHash,
    } = useContext(GlobalContext);
    const { schemata, port, backend, ownsBackend, restartingRef } = useContext(BackendContext);
    const { sendAlert, sendToast } = useContext(AlertBoxContext);
    const nodeChanges = useContextSelector(GlobalVolatileContext, (c) => c.nodeChanges);
    const edgeChanges = useContextSelector(GlobalVolatileContext, (c) => c.edgeChanges);

    const options = useBackendExecutionOptions();

    const { getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();

    const [status, setStatus] = useState(ExecutionStatus.READY);

    const [percentComplete, setPercentComplete] = useState<number | undefined>(undefined);

    useEffect(() => {
        const displayProgress = status === ExecutionStatus.RUNNING ? percentComplete : undefined;
        ipcRenderer.send('set-progress-bar', displayProgress ?? null);
    }, [status, percentComplete]);

    useEffect(() => {
        if (status !== ExecutionStatus.READY) {
            ipcRenderer.send('start-sleep-blocker');
        } else {
            ipcRenderer.send('stop-sleep-blocker');
            setPercentComplete(undefined);
        }
    }, [status]);

    const [eventSource, eventSourceStatus] = useBackendEventSource(port);

    useBackendEventSourceListener(eventSource, 'finish', () => setStatus(ExecutionStatus.READY));

    useBackendEventSourceListener(eventSource, 'execution-error', (data) => {
        if (data) {
            sendAlert({ type: AlertType.ERROR, message: getExecutionErrorMessage(data, schemata) });
            unAnimate();
            setStatus(ExecutionStatus.READY);
        }
    });

    const updateNodeFinish = useBatchedCallback<
        Parameters<BackendEventSourceListener<'node-finish'>>
    >(
        useCallback(
            (eventData) => {
                if (eventData) {
                    const { finished, nodeId, executionTime, data, progressPercent } = eventData;

                    // TODO: This is incorrect. The inputs of the node might have changed since
                    // the chain started running. However, sending the then current input hashes
                    // of the chain to the backend along with the rest of its data and then making
                    // the backend send us those hashes is incorrect too because of iterators, I
                    // think.
                    const inputHash = getInputHash(nodeId);
                    outputDataActions.set(
                        nodeId,
                        executionTime ?? undefined,
                        inputHash,
                        data ?? undefined
                    );
                    if (progressPercent != null) {
                        if (progressPercent === 1) {
                            setPercentComplete(undefined);
                        } else {
                            setPercentComplete(progressPercent);
                        }
                    }

                    unAnimate([nodeId, ...finished]);
                }
            },
            [unAnimate, outputDataActions, getInputHash]
        ),
        500
    );
    useBackendEventSourceListener(eventSource, 'node-finish', updateNodeFinish);

    const updateIteratorProgress = useThrottledCallback<
        BackendEventSourceListener<'iterator-progress-update'>
    >((data) => {
        if (data) {
            const { percent, iteratorId, running: runningNodes } = data;
            if (runningNodes && status === ExecutionStatus.RUNNING) {
                animate(runningNodes);
            } else if (status !== ExecutionStatus.RUNNING) {
                unAnimate();
            }
            setIteratorPercent(iteratorId, percent);
        }
    }, 350);
    useBackendEventSourceListener(eventSource, 'iterator-progress-update', updateIteratorProgress);

    useEffect(() => {
        if (ownsBackend && !restartingRef.current && eventSourceStatus === 'error') {
            log.warn('The backend event source errored.');
            unAnimate();
            setStatus(ExecutionStatus.READY);
        }
    }, [eventSourceStatus, unAnimate, restartingRef, ownsBackend]);

    const lastChangesRef = useRef(`${nodeChanges} ${edgeChanges}`);
    useEffect(() => {
        const currentChanges = `${nodeChanges} ${edgeChanges}`;
        if (lastChangesRef.current === currentChanges) return;
        lastChangesRef.current = currentChanges;

        if (status === ExecutionStatus.RUNNING) {
            sendToast({
                status: 'warning',
                description:
                    'You are modifying the chain while it is running. This will not modify the state of the current execution.',
                id: 'execution-running',
                variant: 'subtle',
                position: 'bottom',
            });
        } else if (status === ExecutionStatus.PAUSED) {
            sendToast({
                status: 'warning',
                description:
                    'You are modifying the chain while it is paused. This will not modify the state of the execution once resumed.',
                id: 'execution-paused',
                variant: 'subtle',
                position: 'bottom',
            });
        }
    }, [status, nodeChanges, edgeChanges, sendToast]);

    const runNodes = useCallback(async () => {
        const allNodes = getNodes();
        const allEdges = getEdges();

        const disabledNodes = new Set(
            getEffectivelyDisabledNodes(allNodes, allEdges).map((n) => n.id)
        );
        const nodesToOptimize = allNodes.filter((n) => !disabledNodes.has(n.id));
        const nodes = getNodesWithSideEffects(nodesToOptimize, allEdges, schemata);
        const nodeIds = new Set(nodes.map((n) => n.id));
        const edges = allEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

        // show an error if there are no nodes to run
        if (nodes.length === 0) {
            let message;
            if (nodesToOptimize.length > 0) {
                message =
                    'There are no nodes that have an effect. Try to view or output images/files.';
            } else if (disabledNodes.size > 0) {
                message = 'All nodes are disabled. There are no nodes to run.';
            } else {
                message = 'There are no nodes to run.';
            }
            sendAlert({ type: AlertType.ERROR, message });
            return;
        }

        // check for static errors
        const invalidNodes = nodes.flatMap((node) => {
            const functionInstance = typeStateRef.current.functions.get(node.data.id);
            const schema = schemata.get(node.data.schemaId);
            const { category, name } = schema;
            const validity = checkNodeValidity({
                inputData: node.data.inputData,
                connectedInputs: getConnectedInputs(node.id, edges),
                schema,
                functionInstance,
            });
            if (validity.isValid) return [];

            return [`• ${category}: ${name}: ${validity.reason}`];
        });
        if (invalidNodes.length > 0) {
            const reasons = invalidNodes.join('\n');
            sendAlert({
                type: AlertType.ERROR,
                message: `There are invalid nodes in the editor. Please fix them before running.\n${reasons}`,
            });
            return;
        }

        try {
            setStatus(ExecutionStatus.RUNNING);
            animate(nodes.map((n) => n.id));

            const data = convertToUsableFormat(nodes, edges, schemata);
            const response = await backend.run({
                data,
                options,
                sendBroadcastData: true,
            });
            if (response.type === 'error') {
                // no need to alert here, because the error has already been handled by the queue
            }
            if (response.type === 'already-running') {
                sendAlert({
                    type: AlertType.ERROR,
                    message: `Cannot start because a previous executor is still running.`,
                });
            }
        } catch (err: unknown) {
            sendAlert({
                type: AlertType.ERROR,
                message: `An unexpected error occurred: ${String(err)}`,
            });
        } finally {
            unAnimate();
            setStatus(ExecutionStatus.READY);
        }
    }, [
        getNodes,
        getEdges,
        schemata,
        sendAlert,
        typeStateRef,
        animate,
        backend,
        options,
        unAnimate,
    ]);

    const resume = useCallback(async () => {
        try {
            const response = await backend.resume();
            if (response.type === 'error') {
                sendAlert({ type: AlertType.ERROR, message: response.exception });
                return;
            }
            if (response.type === 'no-executor') {
                return;
            }
            setStatus(ExecutionStatus.RUNNING);
        } catch (err) {
            sendAlert({ type: AlertType.ERROR, message: 'An unexpected error occurred.' });
        }
    }, [backend, sendAlert]);

    const run = useCallback(async () => {
        if (status === ExecutionStatus.PAUSED) {
            await resume();
        } else {
            await runNodes();
        }
    }, [resume, runNodes, status]);

    const pause = useCallback(async () => {
        try {
            const response = await backend.pause();
            if (response.type === 'error') {
                sendAlert({ type: AlertType.ERROR, message: response.exception });
                return;
            }
            if (response.type === 'no-executor') {
                return;
            }
            setStatus(ExecutionStatus.PAUSED);
        } catch (err) {
            sendAlert({ type: AlertType.ERROR, message: 'An unexpected error occurred.' });
        }
    }, [backend, sendAlert]);

    const kill = useCallback(async () => {
        try {
            const response = await backend.kill();
            if (response.type === 'error') {
                sendAlert({ type: AlertType.ERROR, message: response.exception });
            }
        } catch (err) {
            sendAlert({ type: AlertType.ERROR, message: 'An unexpected error occurred.' });
        }
    }, [backend, sendAlert]);

    useHotkeys(
        'F5',
        useCallback(() => {
            switch (status) {
                case ExecutionStatus.READY:
                case ExecutionStatus.PAUSED:
                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
                    run();
                    break;
                case ExecutionStatus.RUNNING:
                    break;
                default:
                    assertNever(status);
            }
        }, [run, status])
    );

    useHotkeys(
        'F6',
        useCallback(() => {
            switch (status) {
                case ExecutionStatus.RUNNING:
                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
                    pause();
                    break;
                case ExecutionStatus.READY:
                case ExecutionStatus.PAUSED:
                    break;
                default:
                    assertNever(status);
            }
        }, [pause, status])
    );

    useHotkeys(
        'F7',
        useCallback(() => {
            switch (status) {
                case ExecutionStatus.RUNNING:
                case ExecutionStatus.PAUSED:
                    // eslint-disable-next-line @typescript-eslint/no-floating-promises
                    kill();
                    break;
                case ExecutionStatus.READY:
                    break;
                default:
                    assertNever(status);
            }
        }, [kill, status])
    );

    const statusValue = useMemoObject<ExecutionStatusContextValue>({
        status,
        paused: status === ExecutionStatus.PAUSED,
    });

    const value = useMemoObject<ExecutionContextValue>({
        run,
        pause,
        kill,
        status,
    });

    return (
        <ExecutionContext.Provider value={value}>
            <ExecutionStatusContext.Provider value={statusValue}>
                {children}
                <div style={{ display: 'none' }}>
                    {status};{percentComplete}
                </div>
            </ExecutionStatusContext.Provider>
        </ExecutionContext.Provider>
    );
});
