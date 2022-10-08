import { memo, useEffect, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
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
    ParsedHandle,
    assertNever,
    getInputValues,
    parseSourceHandle,
    parseTargetHandle,
} from '../../common/util';
import { getConnectedInputs } from '../helpers/connectedInputs';
import { getEffectivelyDisabledNodes } from '../helpers/disabled';
import { getNodesWithSideEffects } from '../helpers/sideEffect';
import { useAsyncEffect } from '../hooks/useAsyncEffect';
import {
    BackendEventMap,
    BackendEventSourceListener,
    useBackendEventSource,
    useBackendEventSourceListener,
} from '../hooks/useBackendEventSource';
import { useBatchedCallback } from '../hooks/useBatchedCallback';
import { useMemoObject } from '../hooks/useMemo';
import { AlertBoxContext, AlertType } from './AlertBoxContext';
import { BackendContext } from './BackendContext';
import { GlobalContext, GlobalVolatileContext } from './GlobalNodeState';
import { SettingsContext } from './SettingsContext';

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
    isBackendKilled: boolean;
    setIsBackendKilled: React.Dispatch<React.SetStateAction<boolean>>;
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
    const convertHandle = (handle: ParsedHandle<OutputId>): JsonEdgeInput => {
        const schema = nodeSchemaMap.get(handle.nodeId);
        if (!schema) {
            throw new Error(`Invalid handle: The node id ${handle.nodeId} is not valid`);
        }

        const index = schema.outputs.findIndex((inOut) => inOut.id === handle.inOutId);
        if (index === -1) {
            throw new Error(
                `Invalid handle: There is no output with id ${handle.inOutId} in ${schema.name}`
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

        (inputHandles[targetH.nodeId] ??= {})[targetH.inOutId] = convertHandle(sourceH);
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
        const option = i.options?.find((o) => o.value === value);
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
    const { schemata, port, backend } = useContext(BackendContext);
    const { useIsCpu, useIsFp16, usePyTorchGPU, useNcnnGPU, useOnnxGPU, useOnnxExecutionProvider } =
        useContext(SettingsContext);
    const { sendAlert, sendToast } = useContext(AlertBoxContext);
    const { nodeChanges, edgeChanges } = useContextSelector(GlobalVolatileContext, (c) => ({
        nodeChanges: c.nodeChanges,
        edgeChanges: c.edgeChanges,
    }));

    const [isCpu] = useIsCpu;
    const [isFp16] = useIsFp16;
    const [pytorchGPU] = usePyTorchGPU;
    const [ncnnGPU] = useNcnnGPU;
    const [onnxGPU] = useOnnxGPU;
    const [onnxExecutionProvider] = useOnnxExecutionProvider;

    const { getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();

    const [status, setStatus] = useState(ExecutionStatus.READY);

    const [isBackendKilled, setIsBackendKilled] = useState(false);

    useEffect(() => {
        if (status !== ExecutionStatus.READY) {
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
            setStatus(ExecutionStatus.READY);
        },
        [
            // TODO: This is a hack due to useEventSource having a bug related to useEffect jank
            {},
            // status isn't actually used
            status,
            setStatus,
        ]
    );

    useBackendEventSourceListener(
        eventSource,
        'execution-error',
        (data) => {
            if (data) {
                sendAlert(AlertType.ERROR, null, getExecutionErrorMessage(data, schemata));
                unAnimate();
                setStatus(ExecutionStatus.READY);
            }
        },
        [setStatus, unAnimate, schemata, {}]
    );

    const updateNodeFinish = useBatchedCallback<
        Parameters<BackendEventSourceListener<'node-finish'>>
    >(
        (eventData) => {
            if (eventData) {
                const { finished, nodeId, executionTime, data } = eventData;

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

                unAnimate([nodeId, ...finished]);
            }
        },
        500,
        [unAnimate, outputDataActions, getInputHash]
    );
    useBackendEventSourceListener(eventSource, 'node-finish', updateNodeFinish, [
        // TODO: This is a hack due to useEventSource having a bug related to useEffect jank
        {},
        updateNodeFinish,
    ]);

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
    useBackendEventSourceListener(eventSource, 'iterator-progress-update', updateIteratorProgress, [
        animate,
        updateIteratorProgress,
        // TODO: This is a hack due to useEventSource having a bug related to useEffect jank
        {},
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
            unAnimate();
            setStatus(ExecutionStatus.READY);
        }
    }, [eventSourceStatus, unAnimate, isBackendKilled, ownsBackend]);

    const previousStatus = useRef(status);
    useEffect(() => {
        if (
            status === ExecutionStatus.RUNNING &&
            previousStatus.current === ExecutionStatus.RUNNING
        ) {
            sendToast({
                status: 'warning',
                description:
                    'You are modifying the chain while it is running. This will not modify the state of the current execution.',
                id: 'execution-running',
                variant: 'subtle',
                position: 'bottom',
            });
        } else if (
            status === ExecutionStatus.PAUSED &&
            previousStatus.current === ExecutionStatus.PAUSED
        ) {
            sendToast({
                status: 'warning',
                description:
                    'You are modifying the chain while it is paused. This will not modify the state of the execution once resumed.',
                id: 'execution-paused',
                variant: 'subtle',
                position: 'bottom',
            });
        }
        previousStatus.current = status;
    }, [status, nodeChanges, edgeChanges]);

    const runNodes = async () => {
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
            sendAlert(AlertType.ERROR, null, message);
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
            sendAlert(
                AlertType.ERROR,
                null,
                `There are invalid nodes in the editor. Please fix them before running.\n${reasons}`
            );
            return;
        }

        try {
            setStatus(ExecutionStatus.RUNNING);
            animate(nodes.map((n) => n.id));

            const data = convertToUsableFormat(nodes, edges, schemata);
            const response = await backend.run({
                data,
                isCpu,
                isFp16,
                pytorchGPU,
                ncnnGPU,
                onnxGPU,
                onnxExecutionProvider,
            });
            if (response.type === 'error') {
                // no need to alert here, because the error has already been handled by the queue
            }
            if (response.type === 'already-running') {
                sendAlert(
                    AlertType.ERROR,
                    null,
                    `Cannot start because a previous executor is still running.`
                );
            }
        } catch (err: unknown) {
            sendAlert(AlertType.ERROR, null, `An unexpected error occurred: ${String(err)}`);
        } finally {
            unAnimate();
            setStatus(ExecutionStatus.READY);
        }
    };

    const resume = async () => {
        try {
            const response = await backend.resume();
            if (response.type === 'error') {
                sendAlert(AlertType.ERROR, null, response.exception);
                return;
            }
            if (response.type === 'no-executor') {
                return;
            }
            setStatus(ExecutionStatus.RUNNING);
        } catch (err) {
            sendAlert(AlertType.ERROR, null, 'An unexpected error occurred.');
        }
    };

    const run = async () => {
        if (status === ExecutionStatus.PAUSED) {
            await resume();
        } else {
            await runNodes();
        }
    };

    const pause = async () => {
        try {
            const response = await backend.pause();
            if (response.type === 'error') {
                sendAlert(AlertType.ERROR, null, response.exception);
                return;
            }
            if (response.type === 'no-executor') {
                return;
            }
            setStatus(ExecutionStatus.PAUSED);
        } catch (err) {
            sendAlert(AlertType.ERROR, null, 'An unexpected error occurred.');
        }
    };

    const kill = async () => {
        try {
            const response = await backend.kill();
            if (response.type === 'error') {
                sendAlert(AlertType.ERROR, null, response.exception);
            }
        } catch (err) {
            sendAlert(AlertType.ERROR, null, 'An unexpected error occurred.');
        }
    };

    useHotkeys(
        'F5',
        () => {
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
        },
        [run, pause, status]
    );

    useHotkeys(
        'F6',
        () => {
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
        },
        [run, pause, status]
    );

    useHotkeys(
        'F7',
        () => {
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
        },
        [kill]
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
        isBackendKilled,
        setIsBackendKilled,
    });

    return (
        <ExecutionContext.Provider value={value}>
            <ExecutionStatusContext.Provider value={statusValue}>
                {children}
            </ExecutionStatusContext.Provider>
        </ExecutionContext.Provider>
    );
});
