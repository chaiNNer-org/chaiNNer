import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useReactFlow } from 'reactflow';
import { createContext, useContext, useContextSelector } from 'use-context-selector';
import { useThrottledCallback } from 'use-debounce';
import { EdgeData, NodeData } from '../../common/common-types';
import { formatExecutionErrorMessage } from '../../common/formatExecutionErrorMessage';
import { log } from '../../common/log';
import { checkFeatures } from '../../common/nodes/checkFeatures';
import { checkNodeValidity } from '../../common/nodes/checkNodeValidity';
import { getConnectedInputs } from '../../common/nodes/connectedInputs';
import { getEffectivelyDisabledNodes } from '../../common/nodes/disabled';
import { getNodesWithSideEffects } from '../../common/nodes/sideEffect';
import { toBackendJson } from '../../common/nodes/toBackendJson';
import { ipcRenderer } from '../../common/safeIpc';
import { assertNever, delay } from '../../common/util';
import { bothValid } from '../../common/Validity';
import {
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
    KILLING,
}

interface ExecutionStatusContextValue {
    status: ExecutionStatus;
    paused: boolean;
}

export interface IteratorProgress {
    percent?: number;
    eta?: number;
    index?: number;
    total?: number;
}

export interface NodeProgress {
    percent?: number;
    eta?: number;
    index?: number;
    total?: number;
}

interface ExecutionContextValue {
    run: () => Promise<void>;
    pause: () => Promise<void>;
    kill: () => Promise<void>;
    status: ExecutionStatus;
    getNodeProgress: (nodeId: string) => NodeProgress | undefined;
}

export const ExecutionStatusContext = createContext<Readonly<ExecutionStatusContextValue>>({
    status: ExecutionStatus.READY,
    paused: false,
});

export const ExecutionContext = createContext<Readonly<ExecutionContextValue>>(
    {} as ExecutionContextValue
);

// eslint-disable-next-line @typescript-eslint/ban-types
export const ExecutionProvider = memo(({ children }: React.PropsWithChildren<{}>) => {
    const { animate, unAnimate, typeStateRef, outputDataActions, getInputHash } =
        useContext(GlobalContext);
    const { schemata, url, backend, ownsBackend, restartingRef, restart, features, featureStates } =
        useContext(BackendContext);
    const { useBackendSettings } = useContext(SettingsContext);

    const { sendAlert, sendToast } = useContext(AlertBoxContext);
    const nodeChanges = useContextSelector(GlobalVolatileContext, (c) => c.nodeChanges);
    const edgeChanges = useContextSelector(GlobalVolatileContext, (c) => c.edgeChanges);

    const [options] = useBackendSettings;

    const { getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();

    const [status, setStatus] = useState(ExecutionStatus.READY);

    const [percentComplete, setPercentComplete] = useState<number | undefined>(undefined);

    const [nodeProgress, setNodeProgress] = useState<Record<string, NodeProgress | undefined>>({});

    const setNodeProgressImpl = useCallback(
        (nodeId: string, progress: NodeProgress) => {
            setNodeProgress((prev) => ({
                ...prev,
                [nodeId]: progress,
            }));
        },
        [setNodeProgress]
    );

    const getNodeProgress = useCallback(
        (nodeId: string) => {
            return nodeProgress[nodeId];
        },
        [nodeProgress]
    );

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
            setNodeProgress({});
            unAnimate();
        }
    }, [status, unAnimate]);

    const [eventSource, eventSourceStatus] = useBackendEventSource(url);

    useBackendEventSourceListener(eventSource, 'finish', () => {
        setStatus(ExecutionStatus.READY);
        unAnimate();
    });

    useBackendEventSourceListener(eventSource, 'execution-error', (data) => {
        if (data) {
            sendAlert({
                type: AlertType.ERROR,
                message: formatExecutionErrorMessage(
                    data,
                    schemata,
                    (label, value) => `• ${label}: ${value}`
                ),
            });
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
                    const { nodeId, executionTime, data, types, progressPercent } = eventData;

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
                        data ?? undefined,
                        types ?? undefined
                    );
                    if (progressPercent != null) {
                        if (progressPercent === 1) {
                            setPercentComplete(undefined);
                        } else {
                            setPercentComplete(progressPercent);
                        }
                    }

                    unAnimate([nodeId]);
                }
            },
            [unAnimate, outputDataActions, getInputHash]
        ),
        500
    );
    useBackendEventSourceListener(eventSource, 'node-finish', updateNodeFinish);

    const updateNodeStart = useBatchedCallback<
        Parameters<BackendEventSourceListener<'node-start'>>
    >(
        useCallback(
            (eventData) => {
                if (eventData && status === ExecutionStatus.RUNNING) {
                    const { nodeId } = eventData;
                    animate([nodeId]);
                }
            },
            [status, animate]
        ),
        500
    );
    useBackendEventSourceListener(eventSource, 'node-start', updateNodeStart);

    const updateNodeProgress = useThrottledCallback<
        BackendEventSourceListener<'node-progress-update'>
    >(
        useCallback(
            (data) => {
                if (data) {
                    const { percent, index, total, eta, nodeId } = data;
                    setNodeProgressImpl(nodeId, { percent, eta, index, total });
                }
            },
            [setNodeProgressImpl]
        ),
        100,
        { trailing: true }
    );
    useBackendEventSourceListener(eventSource, 'node-progress-update', updateNodeProgress);

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

            const validity = bothValid(
                checkFeatures(schema.features, features, featureStates),
                checkNodeValidity({
                    inputData: node.data.inputData,
                    connectedInputs: getConnectedInputs(node.id, edges),
                    schema,
                    functionInstance,
                })
            );
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

            const data = toBackendJson(nodes, edges, schemata);
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
            if (!(err instanceof DOMException && err.name === 'AbortError')) {
                sendAlert({
                    type: AlertType.ERROR,
                    message: `An unexpected error occurred: ${String(err)}`,
                });
                setTimeout(() => {
                    unAnimate();
                }, 1000);
            }
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
        features,
        featureStates,
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
            setStatus(ExecutionStatus.KILLING);
            const backendKillPromise = backend.kill();
            const timeoutPromise = delay(2500).then(() => ({
                type: 'timeout',
                exception: '',
            }));
            const response = await Promise.race([backendKillPromise, timeoutPromise]);
            if (response.type === 'timeout') {
                await restart();
                log.info('Finished restarting backend');
            }
            if (response.type === 'error') {
                sendAlert({ type: AlertType.ERROR, message: response.exception });
            }
        } catch (err) {
            sendAlert({ type: AlertType.ERROR, message: 'An unexpected error occurred.' });
        }
        setNodeProgress({});
    }, [backend, restart, sendAlert]);

    // This makes sure keystrokes are executed even if the focus is on an input field
    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            if (event.code === 'F5') {
                switch (status) {
                    case ExecutionStatus.READY:
                    case ExecutionStatus.PAUSED:
                        event.preventDefault();
                        run().catch(log.error);
                        break;
                    case ExecutionStatus.RUNNING:
                    case ExecutionStatus.KILLING:
                        break;
                    default:
                        assertNever(status);
                }
            } else if (event.code === 'F6') {
                switch (status) {
                    case ExecutionStatus.RUNNING:
                        event.preventDefault();
                        pause().catch(log.error);
                        break;
                    case ExecutionStatus.READY:
                    case ExecutionStatus.PAUSED:
                    case ExecutionStatus.KILLING:
                        break;
                    default:
                        assertNever(status);
                }
            } else if (event.code === 'F7') {
                switch (status) {
                    case ExecutionStatus.RUNNING:
                    case ExecutionStatus.PAUSED:
                        event.preventDefault();
                        kill().catch(log.error);
                        break;
                    case ExecutionStatus.READY:
                    case ExecutionStatus.KILLING:
                        break;
                    default:
                        assertNever(status);
                }
            }
        };

        document.addEventListener('keydown', handleKeyPress);

        return () => {
            document.removeEventListener('keydown', handleKeyPress);
        };
    }, [run, pause, kill, status]);

    const statusValue = useMemoObject<ExecutionStatusContextValue>({
        status,
        paused: status === ExecutionStatus.PAUSED,
    });

    const value = useMemoObject<ExecutionContextValue>({
        run,
        pause,
        kill,
        status,
        getNodeProgress,
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
