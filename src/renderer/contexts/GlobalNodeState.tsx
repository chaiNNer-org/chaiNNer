import { Expression, Type, evaluate } from '@chainner/navi';
import { parse } from 'path';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Connection,
    Edge,
    Node,
    OnConnectStartParams,
    Viewport,
    XYPosition,
    useReactFlow,
    useViewport,
} from 'reactflow';
import { createContext, useContext } from 'use-context-selector';
import {
    EdgeData,
    InputData,
    InputId,
    InputKind,
    InputValue,
    Mutable,
    NodeData,
    OutputId,
    SchemaId,
} from '../../common/common-types';
import { IdSet } from '../../common/IdSet';
import { log } from '../../common/log';
import { getEffectivelyDisabledNodes } from '../../common/nodes/disabled';
import { ChainLineage } from '../../common/nodes/lineage';
import { TypeState } from '../../common/nodes/TypeState';

import {
    EMPTY_SET,
    ParsedSourceHandle,
    ParsedTargetHandle,
    createUniqueId,
    deriveUniqueId,
    lazy,
    parseSourceHandle,
    parseTargetHandle,
    stringifySourceHandle,
    stringifyTargetHandle,
} from '../../common/util';
import { Validity, invalid } from '../../common/Validity';
import { canConnect } from '../helpers/canConnect';
import {
    copyToClipboard,
    cutAndCopyToClipboard,
    pasteFromClipboard,
} from '../helpers/copyAndPaste';

import {
    PngDataUrl,
    saveDataUrlAsFile,
    takeScreenshot,
    writeDataUrlToClipboard,
} from '../helpers/nodeScreenshot';
import {
    NodeProto,
    copyEdges,
    copyNodes,
    createNode as createNodeImpl,
    setSelected,
    withNewData,
} from '../helpers/reactFlowUtil';
import { GetSetState, SetState } from '../helpers/types';
import { useAsyncEffect } from '../hooks/useAsyncEffect';
import {
    ChangeCounter,
    nextChangeCount,
    useChangeCounter,
    wrapRefChanges,
} from '../hooks/useChangeCounter';
import { useHotkeys } from '../hooks/useHotkeys';
import { useInputHashes } from '../hooks/useInputHashes';
import { useIpcRendererListener } from '../hooks/useIpcRendererListener';
import { useMemoArray, useMemoObject } from '../hooks/useMemo';
import { useOpenRecent } from '../hooks/useOpenRecent';
import {
    OutputDataActions,
    OutputDataEntry,
    useOutputDataStore,
} from '../hooks/useOutputDataStore';
import { getSessionStorageOrDefault, useSessionStorage } from '../hooks/useSessionStorage';
import { ipcRenderer } from '../safeIpc';
import { AlertBoxContext, AlertType } from './AlertBoxContext';
import { BackendContext } from './BackendContext';
import { useSettings } from './SettingsContext';
import type { ParsedSaveData, SaveData } from '../../main/SaveFile';

const EMPTY_CONNECTED: readonly [IdSet<InputId>, IdSet<OutputId>] = [IdSet.empty, IdSet.empty];

interface GlobalVolatile {
    nodeChanges: ChangeCounter;
    edgeChanges: ChangeCounter;
    typeState: TypeState;
    getConnected: (id: string) => readonly [IdSet<InputId>, IdSet<OutputId>];
    isValidConnection: (connection: Readonly<Connection>) => Validity;
    effectivelyDisabledNodes: ReadonlySet<string>;
    chainLineage: ChainLineage;
    zoom: number;
    collidingEdge: string | undefined;
    collidingNode: string | undefined;
    isIndividuallyRunning: (node: string) => boolean;
    inputHashes: ReadonlyMap<string, string>;
    outputDataMap: ReadonlyMap<string, OutputDataEntry>;
    useConnectingFrom: GetSetState<OnConnectStartParams | null>;
}
interface Global {
    reactFlowWrapper: React.RefObject<HTMLDivElement>;
    setNodesRef: React.MutableRefObject<SetState<Node<NodeData>[]>>;
    setEdgesRef: React.MutableRefObject<SetState<Edge<EdgeData>[]>>;
    addNodeChanges: () => void;
    addEdgeChanges: () => void;
    changeNodes: SetState<Node<NodeData>[]>;
    changeEdges: SetState<Edge<EdgeData>[]>;
    selectNode: (nodeId: string) => void;
    addIndividuallyRunning: (node: string) => void;
    removeIndividuallyRunning: (node: string) => void;
    createNode: (proto: NodeProto) => void;
    createEdge: (from: ParsedSourceHandle, to: ParsedTargetHandle) => void;
    createConnection: (connection: Connection) => void;
    setNodeInputValue: <T extends InputValue>(nodeId: string, inputId: InputId, value: T) => void;
    setNodeInputHeight: (nodeId: string, inputId: InputId, value: number) => void;
    setNodeOutputHeight: (nodeId: string, outputId: OutputId, value: number) => void;
    setNodeWidth: (nodeId: string, value: number) => void;
    setNodeName: (nodeId: string, nickname: string | undefined) => void;
    removeNodesById: (ids: readonly string[]) => void;
    removeEdgeById: (id: string) => void;
    duplicateNodes: (nodeIds: readonly string[], withInputEdges?: boolean) => void;
    toggleNodeLock: (id: string) => void;
    resetInputs: (ids: readonly string[]) => void;
    resetConnections: (ids: readonly string[]) => void;
    setNodeDisabled: (id: string, isDisabled: boolean) => void;
    setCollidingEdge: (value: string | undefined) => void;
    setCollidingNode: (value: string | undefined) => void;
    setZoom: SetState<number>;
    exportViewportScreenshot: () => void;
    exportViewportScreenshotToClipboard: () => void;
    setManualOutputType: (nodeId: string, outputId: OutputId, type: Expression | undefined) => void;
    clearManualOutputTypes: (nodes: Iterable<string>) => void;
    typeStateRef: Readonly<React.MutableRefObject<TypeState>>;
    chainLineageRef: Readonly<React.MutableRefObject<ChainLineage>>;
    outputDataActions: OutputDataActions;
    getInputHash: (nodeId: string) => string;
    hasRelevantUnsavedChangesRef: React.MutableRefObject<boolean>;
    setNodeCollapsed: (id: string, isCollapsed: boolean) => void;
    addEdgeBreakpoint: (id: string, position: XYPosition) => void;
    removeEdgeBreakpoint: (id: string) => void;
}

enum SaveResult {
    /** The contents were written to disk. */
    Saved,
    /** The file was not saved either because the file did not chain unsaved changes or because the user said not to. */
    NotSaved,
    /** The user canceled the option. */
    Canceled,
}

// TODO: Find default
export const GlobalVolatileContext = createContext<Readonly<GlobalVolatile>>({} as GlobalVolatile);
export const GlobalContext = createContext<Readonly<Global>>({} as Global);

interface GlobalProviderProps {
    reactFlowWrapper: React.RefObject<HTMLDivElement>;
}

export const GlobalProvider = memo(
    ({ children, reactFlowWrapper }: React.PropsWithChildren<GlobalProviderProps>) => {
        const { sendAlert, sendToast, showAlert } = useContext(AlertBoxContext);
        const { schemata, functionDefinitions, scope, backend } = useContext(BackendContext);
        const { viewportExportPadding } = useSettings();

        const [nodeChanges, addNodeChanges, nodeChangesRef] = useChangeCounter();
        const [edgeChanges, addEdgeChanges, edgeChangesRef] = useChangeCounter();
        const {
            setViewport,
            getViewport,
            getNode,
            getNodes,
            getEdges,
            setNodes: rfSetNodes,
            setEdges: rfSetEdges,
            viewportInitialized,
            screenToFlowPosition,
        } = useReactFlow<NodeData, EdgeData>();

        const currentViewport = useViewport();
        const currentReactFlowInstance = useReactFlow();

        const setNodesRef = useRef<SetState<Node<NodeData>[]>>(rfSetNodes);
        const setEdgesRef = useRef<SetState<Edge<EdgeData>[]>>(rfSetEdges);

        const changeNodes = useMemo(
            () => wrapRefChanges(setNodesRef, addNodeChanges),
            [addNodeChanges]
        );
        const changeEdges = useMemo(
            () => wrapRefChanges(setEdgesRef, addEdgeChanges),
            [addEdgeChanges]
        );

        const [manualOutputTypes, setManualOutputTypes] = useState(() => ({
            map: new Map<string, Map<OutputId, Type>>(),
        }));
        const setManualOutputType = useCallback(
            (nodeId: string, outputId: OutputId, expression: Expression | undefined): void => {
                const getType = () => {
                    if (expression === undefined) {
                        return undefined;
                    }

                    try {
                        return evaluate(expression, scope);
                    } catch (error) {
                        log.error(error);
                        return undefined;
                    }
                };

                setManualOutputTypes(({ map }) => {
                    let inner = map.get(nodeId);
                    const type = getType();
                    if (type) {
                        if (!inner) {
                            inner = new Map();
                            map.set(nodeId, inner);
                        }

                        inner.set(outputId, type);
                    } else {
                        inner?.delete(outputId);
                    }
                    return { map };
                });
            },
            [setManualOutputTypes, scope]
        );
        const clearManualOutputTypes = useCallback(
            (nodes: Iterable<string>): void => {
                setManualOutputTypes(({ map }) => {
                    for (const nodeId of nodes) {
                        map.delete(nodeId);
                    }
                    return { map };
                });
            },
            [setManualOutputTypes]
        );

        const [typeState, setTypeState] = useState(TypeState.empty);
        const typeStateRef = useRef(typeState);
        const [chainLineage, setChainLineage] = useState(ChainLineage.EMPTY);
        const chainLineageRef = useRef(chainLineage);
        useEffect(() => {
            const timerId = setTimeout(() => {
                const nodeMap = new Map(getNodes().map((n) => [n.id, n]));

                // remove manual overrides of nodes that no longer exist
                if (manualOutputTypes.map.size > 0) {
                    const ids = [...manualOutputTypes.map.keys()];
                    for (const id of ids.filter((key) => !nodeMap.has(key))) {
                        // use interior mutability to not cause updates
                        manualOutputTypes.map.delete(id);
                    }
                }

                const types = TypeState.create(
                    nodeMap,
                    getEdges(),
                    manualOutputTypes.map,
                    functionDefinitions,
                    typeStateRef.current
                );
                setTypeState(types);
                typeStateRef.current = types;

                const newLineage = new ChainLineage(schemata, getNodes(), getEdges());
                setChainLineage(newLineage);
                chainLineageRef.current = newLineage;
            }, 100);
            return () => clearTimeout(timerId);
        }, [
            nodeChanges,
            edgeChanges,
            manualOutputTypes,
            functionDefinitions,
            schemata,
            getEdges,
            getNodes,
        ]);

        const [outputDataMap, outputDataActions] = useOutputDataStore();

        // Cache node state to avoid clearing state when refreshing
        useEffect(() => {
            const timerId = setTimeout(() => {
                sessionStorage.setItem('cachedNodes', JSON.stringify(getNodes()));
                sessionStorage.setItem('cachedEdges', JSON.stringify(getEdges()));
            }, 100);
            return () => clearTimeout(timerId);
        }, [nodeChanges, edgeChanges, getEdges, getNodes]);
        useEffect(() => {
            const timerId = setTimeout(() => {
                sessionStorage.setItem('cachedViewport', JSON.stringify(getViewport()));
            }, 100);
            return () => clearTimeout(timerId);
        }, [currentViewport.x, currentViewport.y, currentViewport.zoom, getViewport]);
        const [causeVPEffect, setCauseVPEffect] = useState(0);
        useEffect(() => {
            if (viewportInitialized) {
                const cachedViewport = getSessionStorageOrDefault<Viewport | null>(
                    'cachedViewport',
                    null
                );
                if (cachedViewport) setViewport(cachedViewport);
            }
        }, [viewportInitialized, setViewport, causeVPEffect]);
        useEffect(() => {
            const cachedNodes = getSessionStorageOrDefault<Node<NodeData>[]>('cachedNodes', []);
            const cachedEdges = getSessionStorageOrDefault<Edge<EdgeData>[]>('cachedEdges', []);

            changeNodes(cachedNodes);
            changeEdges(cachedEdges);
            setCauseVPEffect((prev) => prev + 1);
        }, [changeNodes, changeEdges, setCauseVPEffect]);

        const [effectivelyDisabledNodes, setEffectivelyDisabledNodes] =
            useState<ReadonlySet<string>>(EMPTY_SET);
        useEffect(() => {
            const newEffectivelyDisabled = getEffectivelyDisabledNodes(getNodes(), getEdges())
                .map((n) => n.id)
                .sort();
            setEffectivelyDisabledNodes((prev) => {
                const newKey = newEffectivelyDisabled.join(';');
                const oldKey = [...prev].join(';');
                if (oldKey === newKey) {
                    return prev;
                }
                return new Set(newEffectivelyDisabled);
            });
        }, [edgeChanges, nodeChanges, getNodes, getEdges]);

        const [savePath, setSavePathInternal] = useSessionStorage<string | null>('save-path', null);
        const [openRecent, pushOpenPath, removeRecentPath] = useOpenRecent();
        const setSavePath = useCallback(
            (path: string | undefined) => {
                setSavePathInternal(path ?? null);
                if (path) pushOpenPath(path);
            },
            [setSavePathInternal, pushOpenPath]
        );

        const [collidingEdge, setCollidingEdge] = useState<string | undefined>();
        const [collidingNode, setCollidingNode] = useState<string | undefined>();

        const [lastSavedChanges, setLastSavedChanges] = useState<
            readonly [nodeChanges: number, edgeChanges: number]
        >([0, 0]);
        /**
         * Whether the current chain as *relevant* unsaved changes.
         *
         * Some changes to the chain might not be worth saving (e.g. animation status).
         */
        // eslint-disable-next-line react/hook-use-state
        const [hasRelevantUnsavedChanges, setHasRelevantUnsavedChangesImpl] = useState(false);
        const hasRelevantUnsavedChangesRef = useRef(hasRelevantUnsavedChanges);
        const setHasRelevantUnsavedChanges = useCallback((value: boolean) => {
            setHasRelevantUnsavedChangesImpl(value);
            hasRelevantUnsavedChangesRef.current = value;
        }, []);
        useEffect(() => {
            const hasUnsavedChanges =
                lastSavedChanges[0] !== nodeChanges || lastSavedChanges[1] !== edgeChanges;
            const value = hasUnsavedChanges && (getNodes().length > 0 || !!savePath);
            setHasRelevantUnsavedChanges(value);
            ipcRenderer.send('update-has-unsaved-changes', value);
        }, [
            lastSavedChanges,
            savePath,
            nodeChanges,
            edgeChanges,
            getNodes,
            setHasRelevantUnsavedChanges,
        ]);

        useEffect(() => {
            const id = setTimeout(() => {
                const dot = hasRelevantUnsavedChanges ? ' •' : '';
                document.title = `chaiNNer - ${savePath || 'Untitled'}${dot}`;
            }, 200);
            return () => clearTimeout(id);
        }, [savePath, hasRelevantUnsavedChanges]);

        const modifyNode = useCallback(
            (id: string, mapFn: (oldNode: Node<NodeData>) => Node<NodeData>) => {
                changeNodes((nodes) => {
                    const newNodes: Node<NodeData>[] = [];
                    for (const n of nodes) {
                        if (n.id === id) {
                            const newNode = mapFn(n);
                            if (newNode === n) return nodes;
                            newNodes.push(newNode);
                        } else {
                            newNodes.push(n);
                        }
                    }
                    return newNodes;
                });
            },
            [changeNodes]
        );

        const dumpState = useCallback((): SaveData => {
            return {
                nodes: getNodes(),
                edges: getEdges(),
                viewport: getViewport(),
            };
        }, [getNodes, getEdges, getViewport]);

        const performSave = useCallback(
            async (saveAs: boolean): Promise<SaveResult> => {
                try {
                    const saveData = dumpState();
                    if (!saveAs && savePath) {
                        await ipcRenderer.invoke('file-save-json', saveData, savePath);
                    } else {
                        const firstOpenRecent = openRecent[0];
                        const dirname = await ipcRenderer.invoke('path-dirname', firstOpenRecent);
                        const result = await ipcRenderer.invoke(
                            'file-save-as-json',
                            saveData,
                            savePath || (firstOpenRecent && dirname)
                        );
                        if (result.kind === 'Canceled') {
                            return SaveResult.Canceled;
                        }
                        setSavePath(result.path);
                    }
                    setLastSavedChanges([nodeChangesRef.current, edgeChangesRef.current]);
                    return SaveResult.Saved;
                } catch (error) {
                    log.error(error);

                    sendToast({
                        status: 'error',
                        duration: 10_000,
                        description: `Failed to save chain`,
                    });

                    return SaveResult.Canceled;
                }
            },
            [
                dumpState,
                edgeChangesRef,
                nodeChangesRef,
                openRecent,
                savePath,
                sendToast,
                setSavePath,
            ]
        );
        const exportTemplate = useCallback(async () => {
            try {
                const saveData = dumpState();
                saveData.nodes = saveData.nodes.map((n) => {
                    const inputData = { ...n.data.inputData } as Mutable<InputData>;
                    const nodeSchema = schemata.get(n.data.schemaId);
                    nodeSchema.inputs.forEach((input) => {
                        const clearKinds = new Set<InputKind>(['file', 'directory']);
                        if (clearKinds.has(input.kind)) {
                            delete inputData[input.id];
                        }
                    });
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            inputData,
                        },
                    };
                });

                await ipcRenderer.invoke('file-save-as-json', saveData, undefined);
            } catch (error) {
                log.error(error);

                sendToast({
                    status: 'error',
                    duration: 10_000,
                    description: `Failed to export chain`,
                });
            }
        }, [dumpState, schemata, sendToast]);
        const saveUnsavedChanges = useCallback(async (): Promise<SaveResult> => {
            if (!hasRelevantUnsavedChangesRef.current) {
                return SaveResult.NotSaved;
            }

            const resp = await showAlert({
                type: AlertType.WARN,
                title: 'Unsaved changes',
                message: 'The current chain has unsaved changes.',
                buttons: ['Save', "Don't Save", 'Cancel'],
                defaultId: 0,
                cancelId: 2,
            });
            if (resp === 1) {
                // Don't Save
                return SaveResult.NotSaved;
            }
            if (resp === 2) {
                // cancel
                return SaveResult.Canceled;
            }

            return performSave(false);
        }, [showAlert, performSave]);

        useIpcRendererListener(
            'save-before-exit',
            useCallback(() => {
                performSave(false)
                    .then((result) => {
                        if (result === SaveResult.Saved) {
                            ipcRenderer.send('exit-after-save');
                        }
                    })
                    .catch(log.error);
            }, [performSave])
        );

        useIpcRendererListener(
            'save-before-reboot',
            useCallback(() => {
                performSave(false)
                    .then((result) => {
                        if (result === SaveResult.Saved) {
                            ipcRenderer.send('reboot-after-save');
                        }
                    })
                    .catch(log.error);
            }, [performSave])
        );

        const setStateFromJSON = useCallback(
            async (savedData: ParsedSaveData, path: string, loadPosition = false) => {
                if ((await saveUnsavedChanges()) === SaveResult.Canceled) {
                    return;
                }

                const validNodes = savedData.nodes
                    // remove nodes that are not supported
                    .filter((node) => schemata.has(node.data.schemaId))
                    .map((node) => {
                        return {
                            ...node,
                            data: {
                                ...node.data,
                                inputData: {
                                    ...schemata.getDefaultInput(node.data.schemaId),
                                    ...Object.fromEntries(
                                        Object.entries(node.data.inputData).filter(
                                            ([, v]) => v != null
                                        )
                                    ),
                                },
                            },
                        };
                    });
                const validNodeIds = new Set(validNodes.map((n) => n.id));
                const validEdges = savedData.edges
                    // Filter out any edges that do not have a source or target node associated with it
                    .filter(
                        (edge) => validNodeIds.has(edge.target) && validNodeIds.has(edge.source)
                    )
                    // Un-animate all edges, if was accidentally saved when animated
                    .map((edge) => (edge.animated ? { ...edge, animated: false } : edge));

                if (savedData.nodes.length !== validNodes.length) {
                    sendAlert({
                        type: AlertType.WARN,
                        title: 'File contains invalid nodes',
                        message:
                            'The file you are trying to open contains nodes that are unavailable on your system. Check the dependency manager to see if you are missing any dependencies. The file will now be loaded without the incompatible nodes.',
                    });
                }
                if (savedData.tamperedWith) {
                    sendAlert({
                        type: AlertType.WARN,
                        title: 'File has been modified',
                        message:
                            'The file you are trying to open has been modified outside of chaiNNer. The modifications may cause chaiNNer to behave incorrectly or in unexpected ways. The file will now be loaded with the modifications.',
                    });
                }
                const deprecatedNodes = [...new Set(validNodes.map((n) => n.data.schemaId))].filter(
                    (id) => schemata.get(id).deprecated
                );
                if (deprecatedNodes.length > 0) {
                    const list = deprecatedNodes
                        .map((id) => {
                            const schema = schemata.get(id);
                            return `- ${schema.category} > ${schema.name}`;
                        })
                        .join('\n');
                    sendAlert({
                        type: AlertType.WARN,
                        title: 'File contains deprecated nodes',
                        message: `This file contains the following deprecated node(s):\n\n${list}\n\nThis chain will still work right now, but these nodes will stop working in future versions of Chainner.`,
                    });
                }

                outputDataActions.clear();
                setLastSavedChanges([
                    nextChangeCount(nodeChangesRef.current),
                    nextChangeCount(edgeChangesRef.current),
                ]);
                changeNodes(validNodes);
                changeEdges(validEdges);
                if (loadPosition) {
                    setViewport(savedData.viewport);
                }
                setSavePath(path);
                pushOpenPath(path);
            },
            [
                changeEdges,
                changeNodes,
                edgeChangesRef,
                saveUnsavedChanges,
                nodeChangesRef,
                outputDataActions,
                pushOpenPath,
                schemata,
                sendAlert,
                setSavePath,
                setViewport,
            ]
        );
        const setStateFromJSONRef = useRef(setStateFromJSON);
        setStateFromJSONRef.current = setStateFromJSON;

        const clearState = useCallback(async () => {
            if ((await saveUnsavedChanges()) === SaveResult.Canceled) {
                return;
            }

            changeNodes([]);
            changeEdges([]);
            setSavePath(undefined);
            setViewport({ x: 0, y: 0, zoom: 1 });
            outputDataActions.clear();
        }, [
            changeEdges,
            changeNodes,
            saveUnsavedChanges,
            outputDataActions,
            setSavePath,
            setViewport,
        ]);

        // Register New File event handler
        useIpcRendererListener(
            'file-new',
            useCallback(() => {
                clearState().catch(log.error);
            }, [clearState])
        );

        useAsyncEffect(
            () => async () => {
                const result = await ipcRenderer.invoke('get-auto-open');
                if (result) {
                    if (result.kind === 'Success') {
                        await setStateFromJSONRef.current(result.saveData, result.path, true);
                    } else {
                        removeRecentPath(result.path);
                        sendAlert({
                            type: AlertType.ERROR,
                            message: `Unable to open file ${result.path}`,
                        });
                    }
                }
            },
            [removeRecentPath, sendAlert]
        );

        // Register Open File event handler
        useIpcRendererListener(
            'file-open',
            useCallback(
                (_, result) => {
                    if (result.kind === 'Success') {
                        setStateFromJSONRef
                            .current(result.saveData, result.path, true)
                            .catch(log.error);
                    } else {
                        removeRecentPath(result.path);
                        sendAlert({
                            type: AlertType.ERROR,
                            message: `Unable to open file ${result.path}`,
                        });
                    }
                },
                [removeRecentPath, sendAlert]
            )
        );

        // Register Save/Save-As event handlers
        useIpcRendererListener(
            'file-save-as',
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            useCallback(() => performSave(true), [performSave])
        );
        useIpcRendererListener(
            'file-save',
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            useCallback(() => performSave(false), [performSave])
        );
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        useIpcRendererListener('file-export-template', exportTemplate);

        const removeNodesById = useCallback(
            (ids: readonly string[]) => {
                if (ids.length === 0) return;

                const filteredIds = ids.filter((id) => {
                    const node = getNode(id);
                    return !!node;
                });
                const toRemove = new Set(filteredIds);
                changeNodes((nodes) => nodes.filter((n) => !toRemove.has(n.id)));
                changeEdges((edges) =>
                    edges.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target))
                );
            },
            [changeNodes, changeEdges, getNode]
        );

        const removeEdgeById = useCallback(
            (id: string) => {
                changeEdges((edges) => edges.filter((e) => e.id !== id));
            },
            [changeEdges]
        );

        const addEdgeBreakpoint = useCallback(
            (id: string, position: XYPosition) => {
                const newId = createUniqueId();
                const newNode = {
                    type: 'breakPoint',
                    id: newId,
                    position,
                    data: {
                        schemaId: 'chainner:utility:pass_through' as SchemaId,
                        id: newId,
                        inputData: {},
                    },
                };
                changeNodes((nodes) => [...nodes, newNode]);
                changeEdges((edges) => {
                    const edge = edges.find((e) => e.id === id);
                    if (!edge) return edges;
                    const leftEdge: Edge<EdgeData> = {
                        id: deriveUniqueId(`${id}-left`),
                        source: edge.source,
                        sourceHandle: edge.sourceHandle,
                        target: newId,
                        targetHandle: `${newId}-0`,
                        type: 'main',
                        animated: false,
                        data: {},
                    };
                    const rightEdge: Edge<EdgeData> = {
                        id: deriveUniqueId(`${id}-right`),
                        source: newId,
                        sourceHandle: `${newId}-0`,
                        target: edge.target,
                        targetHandle: edge.targetHandle,
                        type: 'main',
                        animated: false,
                        data: {},
                    };
                    const filteredEdges = edges.filter((e) => e.id !== id);
                    return [...filteredEdges, leftEdge, rightEdge];
                });
            },
            [changeEdges, changeNodes]
        );

        const removeEdgeBreakpoint = useCallback(
            (id: string) => {
                changeEdges((edges) => {
                    const edgesConnectedToBreakpoint = edges.filter(
                        (e) => e.source === id || e.target === id
                    );
                    if (edgesConnectedToBreakpoint.length !== 2) {
                        throw new Error('Breakpoint is not connected to exactly two edges');
                    }
                    const leftEdge = edgesConnectedToBreakpoint.find((e) => e.target === id);
                    const rightEdge = edgesConnectedToBreakpoint.find((e) => e.source === id);
                    if (!leftEdge || !rightEdge) {
                        throw new Error(
                            'Unable to find left or right edge connected to breakpoint'
                        );
                    }
                    const combinedEdge = {
                        ...leftEdge,
                        target: rightEdge.target,
                        targetHandle: rightEdge.targetHandle,
                    };
                    const filteredEdges = edges.filter(
                        (e) => e.id !== leftEdge.id && e.id !== rightEdge.id
                    );
                    return [...filteredEdges, combinedEdge];
                });
                // We don't need to remove the breakpoint, it will handle removing itself once it's orphaned
            },
            [changeEdges]
        );

        const selectNode = useCallback(
            (id: string) => {
                changeNodes((nodes) =>
                    nodes.map((n) => {
                        if (n.id === id) {
                            return !n.selected ? { ...n, selected: true } : n;
                        }
                        return n.selected ? { ...n, selected: false } : n;
                    })
                );
            },
            [changeNodes]
        );

        const createNode = useCallback(
            (proto: NodeProto): void => {
                changeNodes((nodes) => {
                    const newNode = createNodeImpl(proto, schemata, true);
                    return [
                        ...nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
                        newNode,
                    ];
                });
            },
            [changeNodes, schemata]
        );

        const createConnection = useCallback(
            ({ source, sourceHandle, target, targetHandle }: Connection) => {
                if (!source || !target) {
                    return;
                }
                const id = createUniqueId();
                const newEdge: Edge<EdgeData> = {
                    id,
                    sourceHandle,
                    targetHandle,
                    source,
                    target,
                    type: 'main',
                    animated: false,
                    data: {},
                };
                changeEdges((edges) => [
                    ...edges.filter((edge) => edge.targetHandle !== targetHandle),
                    newEdge,
                ]);
            },
            [changeEdges]
        );

        const createEdge = useCallback(
            (from: ParsedSourceHandle, to: ParsedTargetHandle): void => {
                createConnection({
                    source: from.nodeId,
                    sourceHandle: stringifySourceHandle(from),
                    target: to.nodeId,
                    targetHandle: stringifyTargetHandle(to),
                });
            },
            [createConnection]
        );

        const isValidConnection = useCallback(
            ({ target, targetHandle, source, sourceHandle }: Readonly<Connection>): Validity => {
                if (!source || !target || !sourceHandle || !targetHandle) {
                    return invalid('Invalid connection data.');
                }

                return canConnect(
                    parseSourceHandle(sourceHandle),
                    parseTargetHandle(targetHandle),
                    typeState,
                    chainLineage
                );
            },
            [typeState, chainLineage]
        );

        const [inputDataChanges, addInputDataChanges] = useChangeCounter();
        const inputHashesRef = useInputHashes(schemata, [
            nodeChanges,
            edgeChanges,
            inputDataChanges,
        ]);
        const getInputHash = useCallback(
            (nodeId: string): string => inputHashesRef.current.get(nodeId) ?? 'invalid node',
            [inputHashesRef]
        );

        const setNodeInputValue = useCallback(
            // eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions, func-names
            function <T extends InputValue>(nodeId: string, inputId: InputId, value: T): void {
                modifyNode(nodeId, (old) => {
                    if (old.data.inputData[inputId] === value) {
                        // there's no need to change anything
                        return old;
                    }

                    return withNewData(old, 'inputData', {
                        ...old.data.inputData,
                        [inputId]: value,
                    });
                });
                addInputDataChanges();
            },
            [modifyNode, addInputDataChanges]
        );

        const setNodeInputHeight = useCallback(
            (nodeId: string, inputId: InputId, height: number): void => {
                modifyNode(nodeId, (old) => {
                    const newInputHeight: Record<string, number> = {
                        ...old.data.inputHeight,
                        [inputId]: height,
                    };
                    return withNewData(old, 'inputHeight', newInputHeight);
                });
            },
            [modifyNode]
        );

        const setNodeOutputHeight = useCallback(
            (nodeId: string, outputId: OutputId, height: number): void => {
                modifyNode(nodeId, (old) => {
                    const newOutputHeight: Record<string, number> = {
                        ...old.data.outputHeight,
                        [outputId]: height,
                    };
                    return withNewData(old, 'outputHeight', newOutputHeight);
                });
            },
            [modifyNode]
        );

        const setNodeWidth = useCallback(
            (nodeId: string, width: number): void => {
                modifyNode(nodeId, (old) => {
                    return withNewData(old, 'nodeWidth', width);
                });
            },
            [modifyNode]
        );

        const setNodeName = useCallback(
            (nodeId: string, name: string | undefined): void => {
                modifyNode(nodeId, (old) => {
                    return withNewData(old, 'nodeName', name);
                });
            },
            [modifyNode]
        );

        const [individuallyRunning, setIndividuallyRunning] =
            useState<ReadonlySet<string>>(EMPTY_SET);
        const addIndividuallyRunning = useCallback((node: string): void => {
            setIndividuallyRunning((prev) => new Set(prev).add(node));
        }, []);
        const removeIndividuallyRunning = useCallback((node: string): void => {
            setIndividuallyRunning((prev) => {
                const newSet = new Set(prev);
                newSet.delete(node);
                return newSet;
            });
        }, []);
        const isIndividuallyRunning = useCallback(
            (node: string): boolean => individuallyRunning.has(node),
            [individuallyRunning]
        );

        const toggleNodeLock = useCallback(
            (id: string) => {
                modifyNode(id, (old): Node<NodeData> => {
                    const isLocked = old.data.isLocked ?? false;
                    return {
                        ...old,
                        draggable: isLocked,
                        connectable: isLocked,
                        data: { ...old.data, isLocked: !isLocked },
                    };
                });
            },
            [modifyNode]
        );

        const connectedInputsMap = useMemo(
            () => {
                return lazy(() => {
                    const map = new Map<string, { in: InputId[]; out: OutputId[] }>();
                    for (const e of getEdges()) {
                        if (e.targetHandle) {
                            let entry = map.get(e.target);
                            if (entry === undefined) {
                                entry = { in: [], out: [] };
                                map.set(e.target, entry);
                            }
                            entry.in.push(parseTargetHandle(e.targetHandle).inputId);
                        }
                        if (e.sourceHandle) {
                            let entry = map.get(e.source);
                            if (entry === undefined) {
                                entry = { in: [], out: [] };
                                map.set(e.source, entry);
                            }
                            entry.out.push(parseSourceHandle(e.sourceHandle).outputId);
                        }
                    }

                    const result = new Map<string, readonly [IdSet<InputId>, IdSet<OutputId>]>();
                    for (const [id, { in: ins, out: outs }] of map.entries()) {
                        result.set(id, [IdSet.from(ins), IdSet.from(outs)]);
                    }
                    return result;
                });
            },
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [edgeChanges, getEdges]
        );
        const getConnected = useCallback(
            (id: string): readonly [IdSet<InputId>, IdSet<OutputId>] =>
                connectedInputsMap().get(id) ?? EMPTY_CONNECTED,
            [connectedInputsMap]
        );

        const duplicateNodes = useCallback(
            (ids: readonly string[], withInputEdges = false) => {
                const nodesToCopy = new Set(ids);

                const duplicationId = createUniqueId();
                const deriveId = (oldId: string) =>
                    nodesToCopy.has(oldId) ? deriveUniqueId(duplicationId + oldId) : oldId;

                changeNodes((nodes) => {
                    const newNodes = copyNodes(
                        nodes.filter((n) => nodesToCopy.has(n.id)),
                        deriveId
                    );
                    const derivedIds = ids.map((id) => deriveId(id));
                    newNodes.forEach((n) => {
                        // eslint-disable-next-line no-param-reassign
                        n.selected = derivedIds.includes(n.id);
                    });
                    return [...setSelected(nodes, false), ...newNodes];
                });

                changeEdges((edges) => {
                    const newEdge = copyEdges(
                        edges.filter((e) => {
                            return nodesToCopy.has(e.target) && nodesToCopy.has(e.source);
                        }),
                        deriveId
                    );

                    if (withInputEdges) {
                        const inputEdges = edges.filter((e) => {
                            return nodesToCopy.has(e.target) && !nodesToCopy.has(e.source);
                        });
                        newEdge.push(
                            ...inputEdges.map<Mutable<Edge<EdgeData>>>((e) => {
                                let { target, targetHandle } = e;
                                target = deriveId(target);
                                targetHandle = targetHandle?.replace(e.target, target);

                                return {
                                    ...e,
                                    id: createUniqueId(),
                                    target,
                                    targetHandle,
                                    selected: false,
                                };
                            })
                        );
                    }

                    return [...setSelected(edges, false), ...newEdge];
                });
            },
            [changeNodes, changeEdges]
        );

        const resetInputs = useCallback(
            (ids: readonly string[]) => {
                ids.forEach((id) => {
                    modifyNode(id, (old) => {
                        return withNewData(
                            old,
                            'inputData',
                            schemata.getDefaultInput(old.data.schemaId)
                        );
                    });
                    outputDataActions.delete(id);
                    addInputDataChanges();
                    backend.clearNodeCacheIndividual(id).catch(log.error);
                });
            },
            [modifyNode, addInputDataChanges, outputDataActions, backend, schemata]
        );

        const resetConnections = useCallback(
            (ids: readonly string[]) => {
                changeEdges((edges) => {
                    return edges.filter((e) => {
                        return !ids.includes(e.source) && !ids.includes(e.target);
                    });
                });
            },
            [changeEdges]
        );

        const setNodeDisabled = useCallback(
            (id: string, isDisabled: boolean): void => {
                modifyNode(id, (n) => {
                    return withNewData(n, 'isDisabled', isDisabled);
                });
            },
            [modifyNode]
        );

        const setNodeCollapsed = useCallback(
            (id: string, isCollapsed: boolean): void => {
                modifyNode(id, (n) => {
                    return withNewData(n, 'isCollapsed', isCollapsed);
                });
            },
            [modifyNode]
        );

        const exportViewportScreenshotAs = useCallback(
            (saveAs: (dataUrl: PngDataUrl) => void) => {
                const currentFlowWrapper = reactFlowWrapper.current;
                if (!(currentFlowWrapper instanceof HTMLElement)) return;

                if (currentReactFlowInstance.getNodes().length === 0) {
                    sendToast({
                        status: 'warning',
                        description: 'Cannot export viewport because there are no nodes.',
                    });
                }

                takeScreenshot(currentFlowWrapper, currentReactFlowInstance, viewportExportPadding)
                    .then(saveAs)
                    .catch(log.error);
            },
            [reactFlowWrapper, currentReactFlowInstance, viewportExportPadding, sendToast]
        );
        const exportViewportScreenshot = useCallback(() => {
            const currentChainName = savePath ? parse(savePath).name : 'Untitled';

            const date = new Date();
            const dateString = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

            const hourString = date.getHours().toString().padStart(2, '0');
            const minuteString = date.getMinutes().toString().padStart(2, '0');
            const timeString = `${hourString}-${minuteString}`;

            const fileName = `chaiNNer-${currentChainName}-${dateString}_${timeString}.png`;

            exportViewportScreenshotAs((dataUrl) => {
                saveDataUrlAsFile(dataUrl, fileName);
            });
        }, [exportViewportScreenshotAs, savePath]);
        const exportViewportScreenshotToClipboard = useCallback(() => {
            exportViewportScreenshotAs((dataUrl) => {
                writeDataUrlToClipboard(dataUrl);
                sendToast({ status: 'success', description: 'Viewport copied to clipboard.' });
            });
        }, [exportViewportScreenshotAs, sendToast]);

        const cutFn = useCallback(() => {
            cutAndCopyToClipboard(getNodes(), getEdges(), changeNodes, changeEdges);
        }, [getNodes, getEdges, changeNodes, changeEdges]);
        const copyFn = useCallback(() => {
            copyToClipboard(getNodes(), getEdges());
        }, [getNodes, getEdges]);
        const pasteFn = useCallback(() => {
            pasteFromClipboard(
                changeNodes,
                changeEdges,
                createNode,
                screenToFlowPosition,
                reactFlowWrapper
            ).catch(log.error);
        }, [changeNodes, changeEdges, createNode, screenToFlowPosition, reactFlowWrapper]);
        const selectAllFn = useCallback(() => {
            changeNodes((nodes) => nodes.map((n) => ({ ...n, selected: true })));
            changeEdges((edges) => edges.map((e) => ({ ...e, selected: true })));
        }, [changeNodes, changeEdges]);
        const duplicateFn = useCallback(() => {
            const nodesToCopy = getNodes().filter((n) => n.selected);
            duplicateNodes(nodesToCopy.map((n) => n.id));
        }, [getNodes, duplicateNodes]);
        const duplicateWithInputEdgesFn = useCallback(() => {
            const nodesToCopy = getNodes().filter((n) => n.selected);
            duplicateNodes(
                nodesToCopy.map((n) => n.id),
                true
            );
        }, [getNodes, duplicateNodes]);

        useHotkeys('ctrl+x, cmd+x', cutFn);
        useIpcRendererListener('cut', cutFn);
        useHotkeys('ctrl+c, cmd+c', copyFn);
        useIpcRendererListener('copy', copyFn);
        useHotkeys('ctrl+v, cmd+v', pasteFn);
        useIpcRendererListener('paste', pasteFn);
        useHotkeys('ctrl+d', duplicateFn);
        useIpcRendererListener('duplicate', duplicateFn);
        useHotkeys('ctrl+shift+d', duplicateWithInputEdgesFn);
        useIpcRendererListener('duplicate-with-input-edges', duplicateWithInputEdgesFn);
        useHotkeys('ctrl+p', exportViewportScreenshot);
        useHotkeys('ctrl+shift+p', exportViewportScreenshotToClipboard);
        useIpcRendererListener(
            'export-viewport',
            useCallback(
                (_, kind) => {
                    if (kind === 'file') {
                        exportViewportScreenshot();
                    } else {
                        exportViewportScreenshotToClipboard();
                    }
                },
                [exportViewportScreenshot, exportViewportScreenshotToClipboard]
            )
        );
        useHotkeys('ctrl+a, cmd+a', selectAllFn);

        const [zoom, setZoom] = useState(1);

        const [connectingFrom, setConnectingFrom] = useState<OnConnectStartParams | null>(null);

        useEffect(() => {
            // remove invalid nodes on schemata changes
            removeNodesById(
                getNodes()
                    .filter((n) => !schemata.has(n.data.schemaId))
                    .map((n) => n.id)
            );
        }, [schemata, getNodes, removeNodesById]);

        const globalVolatileValue = useMemoObject<GlobalVolatile>({
            nodeChanges,
            edgeChanges,
            typeState,
            getConnected,
            effectivelyDisabledNodes,
            chainLineage,
            isValidConnection,
            zoom,
            collidingEdge,
            collidingNode,
            isIndividuallyRunning,
            inputHashes: inputHashesRef.current,
            outputDataMap,
            useConnectingFrom: useMemoArray([connectingFrom, setConnectingFrom] as const),
        });

        const globalValue = useMemoObject<Global>({
            reactFlowWrapper,
            setNodesRef,
            setEdgesRef,
            addNodeChanges,
            addEdgeChanges,
            changeNodes,
            changeEdges,
            selectNode,
            addIndividuallyRunning,
            removeIndividuallyRunning,
            createNode,
            createEdge,
            createConnection,
            setNodeInputValue,
            setNodeInputHeight,
            setNodeOutputHeight,
            setNodeWidth,
            setNodeName,
            toggleNodeLock,
            resetInputs,
            resetConnections,
            removeNodesById,
            removeEdgeById,
            duplicateNodes,
            setCollidingEdge,
            setCollidingNode,
            setNodeDisabled,
            setZoom,
            exportViewportScreenshot,
            exportViewportScreenshotToClipboard,
            setManualOutputType,
            clearManualOutputTypes,
            typeStateRef,
            chainLineageRef,
            outputDataActions,
            getInputHash,
            hasRelevantUnsavedChangesRef,
            setNodeCollapsed,
            addEdgeBreakpoint,
            removeEdgeBreakpoint,
        });

        return (
            <GlobalVolatileContext.Provider value={globalVolatileValue}>
                <GlobalContext.Provider value={globalValue}>{children}</GlobalContext.Provider>
                <div style={{ display: 'none' }}>
                    {nodeChanges};{edgeChanges}
                </div>
            </GlobalVolatileContext.Provider>
        );
    }
);
