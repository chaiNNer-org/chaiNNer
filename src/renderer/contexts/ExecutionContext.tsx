import log from 'electron-log';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useReactFlow } from 'reactflow';
import { createContext, useContext, useContextSelector } from 'use-context-selector';
import { useThrottledCallback } from 'use-debounce';
import { EdgeData, NodeData } from '../../common/common-types';
import { formatExecutionErrorMessage } from '../../common/formatExecutionErrorMessage';
import { checkNodeValidity } from '../../common/nodes/checkNodeValidity';
import { getConnectedInputs } from '../../common/nodes/connectedInputs';
import { getEffectivelyDisabledNodes } from '../../common/nodes/disabled';
import { getNodesWithSideEffects } from '../../common/nodes/sideEffect';
import { toBackendJson } from '../../common/nodes/toBackendJson';
import { ipcRenderer } from '../../common/safeIpc';
import { assertNever, delay } from '../../common/util';
import {
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
    KILLING,
}

interface ExecutionStatusContextValue {
    status: ExecutionStatus;
    paused: boolean;
}

interface IteratorProgress {
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
    useIteratorProgress: (iteratorId: string) => {
        setIteratorProgress: (progress: IteratorProgress) => void;
        removeIteratorProgress: () => void;
        getIteratorProgress: () => IteratorProgress;
    };
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
    const { schemata, port, backend, ownsBackend, restartingRef, restart } =
        useContext(BackendContext);
    const { sendAlert, sendToast } = useContext(AlertBoxContext);
    const nodeChanges = useContextSelector(GlobalVolatileContext, (c) => c.nodeChanges);
    const edgeChanges = useContextSelector(GlobalVolatileContext, (c) => c.edgeChanges);

    const options = useBackendExecutionOptions();

    const { getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();

    const [status, setStatus] = useState(ExecutionStatus.READY);

    const [percentComplete, setPercentComplete] = useState<number | undefined>(undefined);

    const [iteratorProgress, setIteratorProgress] = useState<
        Record<string, IteratorProgress | undefined>
    >({});

    const setIteratorProgressImpl = useCallback(
        (iteratorId: string, progress: IteratorProgress) => {
            setIteratorProgress((prev) => ({
                ...prev,
                [iteratorId]: progress,
            }));
        },
        [setIteratorProgress]
    );

    const removeIteratorProgress = useCallback(
        (iteratorId: string) => {
            setIteratorProgress((prev) => {
                const newProg = { ...prev };
                delete newProg[iteratorId];
                return newProg;
            });
        },
        [setIteratorProgress]
    );

    const getIteratorProgress = useCallback(
        (iteratorId: string) => {
            return iteratorProgress[iteratorId] ?? {};
        },
        [iteratorProgress]
    );

    const useIteratorProgress = useCallback(
        (iteratorId: string) => {
            return {
                setIteratorProgress: (progress: IteratorProgress) =>
                    setIteratorProgressImpl(iteratorId, progress),
                removeIteratorProgress: () => removeIteratorProgress(iteratorId),
                getIteratorProgress: () => getIteratorProgress(iteratorId),
            };
        },
        [setIteratorProgressImpl, removeIteratorProgress, getIteratorProgress]
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
        }
    }, [status]);

    const [eventSource, eventSourceStatus] = useBackendEventSource(port);

    useBackendEventSourceListener(eventSource, 'finish', () => setStatus(ExecutionStatus.READY));

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
                    const { finished, nodeId, executionTime, data, types, progressPercent } =
                        eventData;

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
            const { percent, index, total, eta, iteratorId, running: runningNodes } = data;

            if (runningNodes && status === ExecutionStatus.RUNNING) {
                animate(runningNodes);
                setIteratorProgressImpl(iteratorId, { percent, eta, index, total });
            } else if (status !== ExecutionStatus.RUNNING) {
                unAnimate();
            }
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
        setIteratorProgress({});
    }, [backend, restart, sendAlert]);

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
                case ExecutionStatus.KILLING:
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
                case ExecutionStatus.KILLING:
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
                case ExecutionStatus.KILLING:
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
        useIteratorProgress,
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
