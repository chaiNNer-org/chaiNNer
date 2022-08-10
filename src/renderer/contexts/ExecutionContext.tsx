import { memo, useEffect, useState } from 'react';
import { Edge, Node, useReactFlow } from 'react-flow-renderer';
import { useHotkeys } from 'react-hotkeys-hook';
import { createContext, useContext } from 'use-context-selector';
import { useThrottledCallback } from 'use-debounce';
import {
    EdgeData,
    EdgeHandle,
    InputId,
    NodeData,
    OutputId,
    UsableData,
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
import { checkNodeValidity } from '../helpers/checkNodeValidity';
import { getEffectivelyDisabledNodes } from '../helpers/disabled';
import { getNodesWithSideEffects } from '../helpers/sideEffect';
import { useAsyncEffect } from '../hooks/useAsyncEffect';
import {
    BackendEventSourceListener,
    useBackendEventSource,
    useBackendEventSourceListener,
} from '../hooks/useBackendEventSource';
import { useBatchedCallback } from '../hooks/useBatchedCallback';
import { useMemoObject } from '../hooks/useMemo';
import { AlertBoxContext, AlertType } from './AlertBoxContext';
import { BackendContext } from './BackendContext';
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

    type Handles<I extends InputId | OutputId> = Record<
        string,
        Record<I, EdgeHandle | undefined> | undefined
    >;
    const inputHandles: Handles<InputId> = {};
    const outputHandles: Handles<OutputId> = {};
    edges.forEach((element) => {
        const { sourceHandle, targetHandle } = element;
        if (!sourceHandle || !targetHandle) return;

        const sourceH = parseSourceHandle(sourceHandle);
        const targetH = parseTargetHandle(targetHandle);

        (inputHandles[targetH.nodeId] ??= {})[targetH.inOutId] = convertHandle(sourceH, 'output');
        (outputHandles[sourceH.nodeId] ??= {})[sourceH.inOutId] = convertHandle(targetH, 'input');
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
        result[id] = {
            schemaId,
            id,
            inputs: getInputValues(
                schema,
                (inputId) => inputHandles[id]?.[inputId] ?? inputData[inputId] ?? null
            ),
            child: false,
            nodeType,
            hasSideEffects: schema.hasSideEffects,
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
    const {
        animate,
        unAnimate,
        setIteratorPercent,
        typeStateRef,
        outputDataActions,
        getInputHash,
    } = useContext(GlobalContext);
    const { schemata, port, backend } = useContext(BackendContext);
    const { useIsCpu, useIsFp16 } = useContext(SettingsContext);
    const { sendAlert } = useContext(AlertBoxContext);

    const [isCpu] = useIsCpu;
    const [isFp16] = useIsFp16;

    const { getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();

    const [status, setStatus] = useState(ExecutionStatus.READY);

    const [isBackendKilled, setIsBackendKilled] = useState(false);

    useEffect(() => {
        // TODO: Actually fix this so it un-animates correctly
        const id = setTimeout(() => {
            if (status !== ExecutionStatus.RUNNING) {
                unAnimate();
            }
        }, 1000);
        return () => clearTimeout(id);
    }, [status, unAnimate]);

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
            setStatus(ExecutionStatus.READY);
        },
        [
            // TODO: This is a hack due to useEventSource having a bug related to useEffect jank
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
                let errorSource = '';
                if (data.source) {
                    const schema = schemata.get(data.source.schemaId);
                    let { name } = schema;
                    if (schemata.schemata.filter((s) => s.name === name).length > 1) {
                        // make the name unique using the category of the schema
                        name = `${schema.category} ${schema.name}`;
                    }
                    errorSource = `An error occurred in a ${name} node:\n\n`;
                }

                sendAlert(AlertType.ERROR, null, errorSource + data.exception);
                unAnimate();
                setStatus(ExecutionStatus.READY);
            }
        },
        [setStatus, unAnimate, schemata]
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

    const run = async () => {
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
                id: node.id,
                inputData: node.data.inputData,
                edges,
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
            });
            if (response.exception) {
                // no need to alert here, because the error has already been handled by the queue
                unAnimate();
                setStatus(ExecutionStatus.READY);
            }
        } catch (err: unknown) {
            sendAlert(AlertType.ERROR, null, `An unexpected error occurred: ${String(err)}`);
            unAnimate();
            setStatus(ExecutionStatus.READY);
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
        unAnimate();
    };

    const kill = async () => {
        try {
            const response = await backend.kill();
            unAnimate();
            if (response.exception) {
                sendAlert(AlertType.ERROR, null, response.exception);
            }
        } catch (err) {
            sendAlert(AlertType.ERROR, null, 'An unexpected error occurred.');
        }
        unAnimate();
        setStatus(ExecutionStatus.READY);
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

    const value = useMemoObject<ExecutionContextValue>({
        run,
        pause,
        kill,
        status,
        isBackendKilled,
        setIsBackendKilled,
    });

    return <ExecutionContext.Provider value={value}>{children}</ExecutionContext.Provider>;
});
