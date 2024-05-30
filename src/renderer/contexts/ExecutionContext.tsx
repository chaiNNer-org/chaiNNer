import { evaluate } from '@chainner/navi';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow } from 'reactflow';
import { createContext, useContext, useContextSelector } from 'use-context-selector';
import { BackendEventMap } from '../../common/Backend';
import { EdgeData, NodeData, OutputId } from '../../common/common-types';
import { formatExecutionErrorMessage } from '../../common/formatExecutionErrorMessage';
import { log } from '../../common/log';
import { checkFeatures } from '../../common/nodes/checkFeatures';
import { checkNodeValidity } from '../../common/nodes/checkNodeValidity';
import { getConnectedInputs } from '../../common/nodes/connectedInputs';
import { optimizeChain } from '../../common/nodes/optimize';
import { toBackendJson } from '../../common/nodes/toBackendJson';
import { getChainnerScope } from '../../common/types/chainner-scope';
import { fromJson } from '../../common/types/json';
import { EMPTY_MAP, EMPTY_SET, assertNever, groupBy } from '../../common/util';
import { bothValid } from '../../common/Validity';
import {
    ChainProgress,
    getInitialChainProgress,
    getTotalProgress,
    withNodeProgress,
} from '../helpers/chainProgress';
import {
    BackendEventSource,
    useBackendEventSource,
    useBackendEventSourceListener,
} from '../hooks/useBackendEventSource';
import { EventBacklog, useEventBacklog } from '../hooks/useEventBacklog';
import { useMemoObject } from '../hooks/useMemo';
import { useSettings } from '../hooks/useSettings';
import { ipcRenderer } from '../safeIpc';
import { AlertBoxContext, AlertType } from './AlertBoxContext';
import { BackendContext } from './BackendContext';
import { GlobalContext, GlobalVolatileContext } from './GlobalNodeState';

// eslint-disable-next-line react-refresh/only-export-components
export enum ExecutionStatus {
    READY,
    RUNNING,
    PAUSED,
    KILLING,
}

// eslint-disable-next-line react-refresh/only-export-components
export enum NodeExecutionStatus {
    /**
     * The node has not been run yet and is awaiting execution.
     */
    YET_TO_RUN,
    /**
     * The node is currently running.
     */
    RUNNING,
    /**
     * The node has finished running successfully.
     */
    FINISHED,
    /**
     * The is not part of the current execution. It has not and will not be executed.
     */
    NOT_EXECUTING,
}

interface ExecutionStatusContextValue {
    status: ExecutionStatus;
    paused: boolean;
}

export interface NodeProgress {
    progress: number;
    eta: number;
    index: number;
    total: number;
}

interface ExecutionContextValue {
    run: () => Promise<void>;
    pause: () => Promise<void>;
    kill: () => Promise<void>;
    status: ExecutionStatus;
    paused: boolean;
    getNodeProgress: (nodeId: string) => NodeProgress | undefined;
    getNodeStatus: (nodeId: string) => NodeExecutionStatus;
    executionNumber: number;
}

export const ExecutionStatusContext = createContext<Readonly<ExecutionStatusContextValue>>({
    status: ExecutionStatus.READY,
    paused: false,
});

export const ExecutionContext = createContext<Readonly<ExecutionContextValue>>(
    {} as ExecutionContextValue
);

interface BackloggedEvent<K extends keyof BackendEventMap> {
    type: K;
    data: BackendEventMap[K];
}
type NodeEvents =
    | BackloggedEvent<'node-start'>
    | BackloggedEvent<'node-progress'>
    | BackloggedEvent<'node-broadcast'>
    | BackloggedEvent<'node-finish'>;

const useRegisterNodeEvents = (
    eventSource: BackendEventSource | null,
    backlog: EventBacklog<NodeEvents>
) => {
    useBackendEventSourceListener(
        eventSource,
        'node-start',
        (f) => f && backlog.push({ type: 'node-start', data: f })
    );
    useBackendEventSourceListener(
        eventSource,
        'node-progress',
        (f) => f && backlog.push({ type: 'node-progress', data: f })
    );
    useBackendEventSourceListener(
        eventSource,
        'node-broadcast',
        (f) => f && backlog.push({ type: 'node-broadcast', data: f })
    );
    useBackendEventSourceListener(
        eventSource,
        'node-finish',
        (f) => f && backlog.push({ type: 'node-finish', data: f })
    );
};

// eslint-disable-next-line @typescript-eslint/ban-types
export const ExecutionProvider = memo(({ children }: React.PropsWithChildren<{}>) => {
    const {
        typeStateRef,
        chainLineageRef,
        outputDataActions,
        getInputHash,
        setManualOutputType,
        clearManualOutputTypes,
    } = useContext(GlobalContext);
    const {
        schemata,
        url,
        backend,
        ownsBackend,
        backendDownRef,
        features,
        featureStates,
        categories,
        passthrough,
    } = useContext(BackendContext);
    const { packageSettings } = useSettings();

    const { sendAlert, sendToast } = useContext(AlertBoxContext);
    const nodeChanges = useContextSelector(GlobalVolatileContext, (c) => c.nodeChanges);
    const edgeChanges = useContextSelector(GlobalVolatileContext, (c) => c.edgeChanges);

    const { getNodes, getEdges } = useReactFlow<NodeData, EdgeData>();

    const [status, setStatus] = useState(ExecutionStatus.READY);

    const [executionNumber, setExecutionNumber] = useState(1);

    const [chainProgress, setChainProgress] = useState<ChainProgress>(EMPTY_MAP);
    const totalChainProgress = useMemo(() => getTotalProgress(chainProgress), [chainProgress]);

    const [nodeProgress, setNodeProgress] = useState<Record<string, NodeProgress | undefined>>({});
    const setNodeProgressImpl = useCallback(
        (nodeId: string, progress: NodeProgress) => {
            setNodeProgress((prev) => ({ ...prev, [nodeId]: progress }));
        },
        [setNodeProgress]
    );
    const getNodeProgress = useCallback((nodeId: string) => nodeProgress[nodeId], [nodeProgress]);

    type ActiveStatus = Exclude<NodeExecutionStatus, NodeExecutionStatus.NOT_EXECUTING>;
    const [nodeStatusMap, setNodeStatusMap] =
        useState<ReadonlyMap<string, ActiveStatus>>(EMPTY_MAP);
    const clearNodeStatusMap = useCallback(() => setNodeStatusMap(EMPTY_MAP), []);
    const setNodeStatus = useCallback((executionStatus: ActiveStatus, nodes: Iterable<string>) => {
        setNodeStatusMap((prev) => {
            const newMap = new Map(prev);
            for (const nodeId of nodes) {
                newMap.set(nodeId, executionStatus);
            }
            return newMap;
        });
    }, []);
    const getNodeStatus = useCallback(
        (nodeId: string) => nodeStatusMap.get(nodeId) ?? NodeExecutionStatus.NOT_EXECUTING,
        [nodeStatusMap]
    );

    useEffect(() => {
        if (status === ExecutionStatus.RUNNING || status === ExecutionStatus.PAUSED) {
            ipcRenderer.send('set-progress-bar', totalChainProgress);
        } else {
            ipcRenderer.send('set-progress-bar', null);
        }
    }, [status, totalChainProgress]);

    useEffect(() => {
        if (status !== ExecutionStatus.READY) {
            ipcRenderer.send('start-sleep-blocker');
        } else {
            ipcRenderer.send('stop-sleep-blocker');
            setChainProgress(EMPTY_MAP);
            setNodeProgress({});
            clearNodeStatusMap();
        }
    }, [status, clearNodeStatusMap]);

    const executingIteratorNodesRef = useRef<ReadonlySet<string>>(EMPTY_SET);

    const processSingleNode = (nodeId: string, events: NodeEvents[]) => {
        let executionStatus;
        let executionTime;
        let broadcastData;
        let types;
        let progress;

        for (const { type, data } of events) {
            if (type === 'node-start') {
                executionStatus = NodeExecutionStatus.RUNNING as const;
            } else if (type === 'node-finish') {
                executionStatus = NodeExecutionStatus.FINISHED as const;
                executionTime = data.executionTime;
            } else if (type === 'node-broadcast') {
                broadcastData = data.data;
                types = data.types;
            } else {
                progress = data;
            }
        }

        if (executionStatus !== undefined) {
            setNodeStatus(executionStatus, [nodeId]);
        }

        if (executionTime !== undefined || broadcastData !== undefined || types !== undefined) {
            // TODO: This is incorrect. The inputs of the node might have changed since
            // the chain started running. However, sending the then current input hashes
            // of the chain to the backend along with the rest of its data and then making
            // the backend send us those hashes is incorrect too because of iterators, I
            // think.
            const inputHash = getInputHash(nodeId);
            outputDataActions.set(nodeId, executionTime, inputHash, broadcastData, types);
        }

        if (progress) {
            setNodeProgressImpl(nodeId, progress);
        }

        if (executionStatus === NodeExecutionStatus.FINISHED || progress) {
            const p = progress?.progress ?? 1;
            setChainProgress((prev) => withNodeProgress(prev, nodeId, p));
        }

        if (executingIteratorNodesRef.current.has(nodeId) && types) {
            // we want to update the output types of the iterator nodes
            for (const [outputId, typeExpr] of Object.entries(types)) {
                if (typeExpr) {
                    try {
                        const type = evaluate(fromJson(typeExpr), getChainnerScope());
                        setManualOutputType(nodeId, Number(outputId) as OutputId, type);
                    } catch (error) {
                        log.error(error);
                    }
                }
            }
        }
    };
    const nodeEventBacklog = useEventBacklog({
        process: (events: NodeEvents[]) => {
            const byNodeId = groupBy(events, (e) => e.data.nodeId);
            for (const [nodeId, nodeEvents] of byNodeId) {
                processSingleNode(nodeId, nodeEvents);
            }
        },
        interval: 100,
    });

    const [eventSource, eventSourceStatus] = useBackendEventSource(url);
    useRegisterNodeEvents(eventSource, nodeEventBacklog);

    useBackendEventSourceListener(eventSource, 'execution-error', (data) => {
        if (data) {
            sendAlert({
                type: AlertType.ERROR,
                message: formatExecutionErrorMessage(
                    data,
                    schemata,
                    (label, value) => `• ${label}: ${value}`,
                    (nodeId) => getNodes().find((n) => n.id === nodeId)?.data.nodeName
                ),
                trace: data.exceptionTrace,
            });
            clearNodeStatusMap();
            setStatus(ExecutionStatus.READY);
        }
    });

    useBackendEventSourceListener(eventSource, 'chain-start', (data) => {
        if (data) {
            clearNodeStatusMap();
            setNodeStatus(NodeExecutionStatus.YET_TO_RUN, data.nodes);

            // the backend might have optimized away some nodes and we have to
            // take that into account for progress
            setChainProgress((prev) => {
                const newProgress = new Map(prev);
                const allowed = new Set(data.nodes);
                for (const key of [...newProgress.keys()].filter((k) => !allowed.has(k))) {
                    newProgress.delete(key);
                }
                return newProgress;
            });
        }
    });

    useEffect(() => {
        if (ownsBackend && !backendDownRef.current && eventSourceStatus === 'error') {
            log.warn('The backend event source errored.');
            clearNodeStatusMap();
            setStatus(ExecutionStatus.READY);
        }
    }, [eventSourceStatus, clearNodeStatusMap, backendDownRef, ownsBackend]);

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
        const { nodes, edges, report } = optimizeChain(
            getNodes(),
            getEdges(),
            schemata,
            passthrough
        );

        // show an error if there are no nodes to run
        if (nodes.length === 0) {
            let message;
            if (report.removedSideEffectFree > 0) {
                message =
                    'There are no nodes that have an effect. Try to view or output images/files.';
            } else if (report.removedDisabled > 0) {
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
            const { name } = schema;
            const category = categories.get(schema.category)?.name ?? schema.category;

            const validity = bothValid(
                checkFeatures(schema.features, features, featureStates),
                checkNodeValidity({
                    inputData: node.data.inputData,
                    connectedInputs: getConnectedInputs(node.id, edges),
                    schema,
                    functionInstance,
                    chainLineage: chainLineageRef.current,
                    nodeId: node.id,
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

        // find iterator nodes for later
        const iteratorNodeIds = new Set(
            nodes
                .filter((n) => schemata.get(n.data.schemaId).kind === 'newIterator')
                .map((n) => n.data.id)
        );
        executingIteratorNodesRef.current = iteratorNodeIds;
        setChainProgress(getInitialChainProgress(nodes, edges, schemata));

        try {
            setStatus(ExecutionStatus.RUNNING);

            const data = toBackendJson(nodes, edges, schemata);
            const response = await backend.run({
                data,
                options: packageSettings,
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
                    clearNodeStatusMap();
                }, 1000);
            }
        } finally {
            nodeEventBacklog.processAll();
            clearNodeStatusMap();
            setStatus(ExecutionStatus.READY);
            clearManualOutputTypes(iteratorNodeIds);
        }
    }, [
        getNodes,
        getEdges,
        schemata,
        categories,
        sendAlert,
        typeStateRef,
        passthrough,
        chainLineageRef,
        features,
        featureStates,
        backend,
        packageSettings,
        clearNodeStatusMap,
        nodeEventBacklog,
        clearManualOutputTypes,
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
            setExecutionNumber((prev) => prev + 1);
        }
    }, [resume, runNodes, status, setExecutionNumber]);

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
            backend.abort();
            // We need to set the status again, since run() resets it to READY
            // We have to do this in a setTimeout, otherwise react doesn't honor this
            const killBackendAndWait = new Promise<void>((resolve, reject) =>
                // eslint-disable-next-line no-promise-executor-return, @typescript-eslint/no-misused-promises
                setTimeout(async () => {
                    setStatus(ExecutionStatus.KILLING);
                    try {
                        const response = await backend.kill();
                        if (response.type === 'error') {
                            sendAlert({ type: AlertType.ERROR, message: response.exception });
                        }
                        await backend.nodes();
                    } catch (err) {
                        reject(err);
                    } finally {
                        setStatus(ExecutionStatus.READY);
                        resolve();
                    }
                }, 0)
            );
            await killBackendAndWait;
        } catch (err) {
            sendAlert({ type: AlertType.ERROR, message: 'An unexpected error occurred.' });
        }
        setNodeProgress({});
    }, [backend, sendAlert]);

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
        paused: status === ExecutionStatus.PAUSED,
        getNodeProgress,
        getNodeStatus,
        executionNumber,
    });

    return (
        <ExecutionContext.Provider value={value}>
            <ExecutionStatusContext.Provider value={statusValue}>
                {children}
                <div style={{ display: 'none' }}>
                    {status};{totalChainProgress}
                </div>
            </ExecutionStatusContext.Provider>
        </ExecutionContext.Provider>
    );
});
