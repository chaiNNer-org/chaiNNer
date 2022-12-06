import { Expression, Type, evaluate } from '@chainner/navi';
import log from 'electron-log';
import { toPng } from 'html-to-image';
import { dirname, parse } from 'path';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Connection,
    Edge,
    Node,
    OnConnectStartParams,
    Viewport,
    getOutgoers,
    useReactFlow,
    useViewport,
} from 'reactflow';
import { createContext, useContext } from 'use-context-selector';
import {
    EdgeData,
    InputData,
    InputId,
    InputKind,
    InputSize,
    InputValue,
    IteratorSize,
    Mutable,
    NodeData,
    OutputId,
    Size,
} from '../../common/common-types';
import { ipcRenderer } from '../../common/safeIpc';
import { ParsedSaveData, SaveData, openSaveFile } from '../../common/SaveFile';
import { getChainnerScope } from '../../common/types/chainner-scope';
import {
    generateAssignmentErrorTrace,
    printErrorTrace,
    simpleError,
} from '../../common/types/mismatch';
import {
    EMPTY_SET,
    createUniqueId,
    deepCopy,
    deriveUniqueId,
    parseSourceHandle,
    parseTargetHandle,
} from '../../common/util';
import { VALID, Validity, invalid } from '../../common/Validity';
import {
    copyToClipboard,
    cutAndCopyToClipboard,
    pasteFromClipboard,
} from '../helpers/copyAndPaste';
import { getEffectivelyDisabledNodes } from '../helpers/disabled';
import {
    NodeProto,
    copyEdges,
    copyNode,
    copyNodes,
    createNode as createNodeImpl,
    defaultIteratorSize,
    expandSelection,
    setSelected,
} from '../helpers/reactFlowUtil';
import { GetSetState, SetState } from '../helpers/types';
import { TypeState } from '../helpers/TypeState';
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
import { AlertBoxContext, AlertType } from './AlertBoxContext';
import { BackendContext } from './BackendContext';
import { SettingsContext } from './SettingsContext';

// eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions, react-memo/require-memo
function getNodeInputValue<T extends NonNullable<InputValue>>(
    inputId: InputId,
    inputData: InputData
): T | undefined {
    return (inputData[inputId] ?? undefined) as T | undefined;
}

interface GlobalVolatile {
    nodeChanges: ChangeCounter;
    edgeChanges: ChangeCounter;
    typeState: TypeState;
    isNodeInputLocked: (id: string, inputId: InputId) => boolean;
    isValidConnection: (connection: Readonly<Connection>) => Validity;
    effectivelyDisabledNodes: ReadonlySet<string>;
    zoom: number;
    hoveredNode: string | undefined;
    collidingEdge: string | undefined;
    collidingNode: string | undefined;
    isAnimated: (nodeId: string) => boolean;
    inputHashes: ReadonlyMap<string, string>;
    outputDataMap: ReadonlyMap<string, OutputDataEntry>;
    useConnectingFrom: GetSetState<OnConnectStartParams | null>;
}
interface Global {
    reactFlowWrapper: React.RefObject<Element>;
    defaultIteratorSize: Readonly<Size>;
    setNodesRef: React.MutableRefObject<SetState<Node<NodeData>[]>>;
    setEdgesRef: React.MutableRefObject<SetState<Edge<EdgeData>[]>>;
    addNodeChanges: () => void;
    addEdgeChanges: () => void;
    changeNodes: SetState<Node<NodeData>[]>;
    changeEdges: SetState<Edge<EdgeData>[]>;
    selectNode: (nodeId: string) => void;
    animate: (nodeIdsToAnimate: Iterable<string>, animateEdges?: boolean) => void;
    unAnimate: (nodeIdsToAnimate?: Iterable<string>) => void;
    createNode: (proto: NodeProto, parentId?: string) => void;
    createConnection: (connection: Connection) => void;
    getNodeInputValue: <T extends NonNullable<InputValue>>(
        inputId: InputId,
        inputData: InputData
    ) => T | undefined;
    setNodeInputValue: <T extends InputValue>(nodeId: string, inputId: InputId, value: T) => void;
    useInputSize: (
        id: string,
        inputId: InputId,
        inputSize: InputSize | undefined
    ) => readonly [Readonly<Size> | undefined, (size: Readonly<Size>) => void];
    removeNodesById: (ids: readonly string[]) => void;
    removeEdgeById: (id: string) => void;
    duplicateNodes: (nodeIds: readonly string[]) => void;
    toggleNodeLock: (id: string) => void;
    clearNodes: (ids: readonly string[]) => void;
    setIteratorSize: (id: string, size: IteratorSize) => void;
    updateIteratorBounds: (
        id: string,
        iteratorSize: IteratorSize | null,
        dimensions?: Size
    ) => void;
    setIteratorPercent: (id: string, percent: number) => void;
    setNodeDisabled: (id: string, isDisabled: boolean) => void;
    setHoveredNode: (value: string | undefined) => void;
    setCollidingEdge: (value: string | undefined) => void;
    setCollidingNode: (value: string | undefined) => void;
    setZoom: SetState<number>;
    exportViewportScreenshot: () => void;
    setManualOutputType: (nodeId: string, outputId: OutputId, type: Expression | undefined) => void;
    typeStateRef: Readonly<React.MutableRefObject<TypeState>>;
    releaseNodeFromParent: (id: string) => void;
    outputDataActions: OutputDataActions;
    getInputHash: (nodeId: string) => string;
    hasRelevantUnsavedChangesRef: React.MutableRefObject<boolean>;
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
    reactFlowWrapper: React.RefObject<Element>;
}

export const GlobalProvider = memo(
    ({ children, reactFlowWrapper }: React.PropsWithChildren<GlobalProviderProps>) => {
        const { sendAlert, sendToast, showAlert } = useContext(AlertBoxContext);
        const { schemata, functionDefinitions, backend } = useContext(BackendContext);
        const { useStartupTemplate, useViewportExportPadding } = useContext(SettingsContext);

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
            project,
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
                        return evaluate(expression, getChainnerScope());
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
            [setManualOutputTypes]
        );

        const [typeState, setTypeState] = useState(TypeState.empty);
        const typeStateRef = useRef(typeState);
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
                    functionDefinitions
                );
                setTypeState(types);
                typeStateRef.current = types;
            }, 100);
            return () => clearTimeout(timerId);
        }, [nodeChanges, edgeChanges, manualOutputTypes, functionDefinitions, getEdges, getNodes]);

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

        const hoveredNodeRef = useRef<string>();
        // eslint-disable-next-line react/hook-use-state
        const [hoveredNode, setHoveredNodeImpl] = useState<string | undefined>();
        const setHoveredNode = useCallback((value: string | undefined) => {
            hoveredNodeRef.current = value;
            setHoveredNodeImpl(value);
        }, []);

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
                        const result = await ipcRenderer.invoke(
                            'file-save-as-json',
                            saveData,
                            savePath || (openRecent[0] && dirname(openRecent[0]))
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

                const result = await ipcRenderer.invoke('file-save-as-json', saveData, undefined);
                if (result.kind === 'Canceled') return;
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
                    .catch((reason) => log.error(reason));
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
                                    ...node.data.inputData,
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
                clearState().catch((reason) => log.error(reason));
            }, [clearState])
        );

        useAsyncEffect(
            () => async () => {
                const result = await ipcRenderer.invoke('get-cli-open');
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
                            .catch((reason) => log.error(reason));
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

        const [firstLoad, setFirstLoad] = useSessionStorage('firstLoad', true);
        const [startupTemplate] = useStartupTemplate;
        useAsyncEffect(
            () => async () => {
                if (firstLoad && startupTemplate) {
                    try {
                        const saveFile = await openSaveFile(startupTemplate);
                        if (saveFile.kind === 'Success') {
                            await setStateFromJSONRef.current(saveFile.saveData, '', true);
                        } else {
                            sendAlert({
                                type: AlertType.ERROR,
                                message: `Unable to open file ${startupTemplate}: ${saveFile.error}`,
                            });
                        }
                    } catch (error) {
                        log.error(error);
                        sendAlert({
                            type: AlertType.ERROR,
                            message: `Unable to open file ${startupTemplate}`,
                        });
                    }
                    setFirstLoad(false);
                }
            },
            [firstLoad, sendAlert, setFirstLoad, startupTemplate]
        );

        const removeNodesById = useCallback(
            (ids: readonly string[]) => {
                if (ids.length === 0) return;

                const filteredIds = ids.filter((id) => {
                    const node = getNode(id);
                    return !(!node || node.type === 'iteratorHelper');
                });
                const toRemove = new Set([
                    ...filteredIds,
                    ...getNodes()
                        .filter((n) => n.parentNode && filteredIds.includes(n.parentNode))
                        .map((n) => n.id),
                ]);
                changeNodes((nodes) => nodes.filter((n) => !toRemove.has(n.id)));
                changeEdges((edges) =>
                    edges.filter((e) => !toRemove.has(e.source) && !toRemove.has(e.target))
                );
            },
            [changeNodes, changeEdges, getNode, getNodes]
        );

        const removeEdgeById = useCallback(
            (id: string) => {
                changeEdges((edges) => edges.filter((e) => e.id !== id));
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
            (proto: NodeProto, parentId?: string): void => {
                changeNodes((nodes) => {
                    const searchId = parentId ?? hoveredNodeRef.current;
                    const parent = searchId ? nodes.find((n) => n.id === searchId) : undefined;
                    const newNodes = createNodeImpl(proto, schemata, parent, true);
                    return [
                        ...nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
                        ...newNodes,
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

        const releaseNodeFromParent = useCallback(
            (id: string) => {
                const nodes = getNodes();
                const edges = getEdges();
                const node = nodes.find((n) => n.id === id);
                let newNodes = nodes;
                if (node && node.parentNode) {
                    const parentNode = nodes.find((n) => n.id === node.parentNode);
                    if (parentNode) {
                        const newNode: Node<Mutable<NodeData>> = deepCopy(node);
                        delete newNode.parentNode;
                        delete newNode.data.parentNode;
                        delete newNode.extent;
                        delete newNode.positionAbsolute;
                        newNode.position = {
                            x: parentNode.position.x - 100,
                            y: parentNode.position.y - 100,
                        };
                        newNodes = [...nodes.filter((n) => n.id !== node.id), newNode];
                    }
                }
                changeNodes(newNodes);
                const sourceEdges = edges.filter((e) => e.target === id);
                const filteredEdges = edges.filter((e) => {
                    const invalidSources = nodes
                        .filter((n) => n.parentNode && sourceEdges.some((ed) => ed.source === n.id))
                        .map((n) => n.id);
                    return !invalidSources.includes(e.source);
                });
                changeEdges(filteredEdges);
            },
            [changeNodes, changeEdges, getNodes, getEdges]
        );

        const isValidConnection = useCallback(
            ({ target, targetHandle, source, sourceHandle }: Readonly<Connection>): Validity => {
                if (source === target) {
                    return invalid('Cannot connect a node to itself.');
                }

                if (!source || !target || !sourceHandle || !targetHandle) {
                    return invalid('Invalid connection data.');
                }
                const sourceHandleId = parseSourceHandle(sourceHandle).outputId;
                const targetHandleId = parseTargetHandle(targetHandle).inputId;

                const sourceFn = typeState.functions.get(source);
                const targetFn = typeState.functions.get(target);

                if (!sourceFn || !targetFn) {
                    return invalid('Invalid connection data.');
                }

                const sourceNode = getNode(source);
                const targetNode = getNode(target);
                if (!sourceNode || !targetNode) {
                    return invalid('Invalid node data.');
                }

                const outputType = sourceFn.outputs.get(sourceHandleId);
                if (outputType !== undefined && !targetFn.canAssign(targetHandleId, outputType)) {
                    const schema = schemata.get(targetNode.data.schemaId);
                    const input = schema.inputs.find((i) => i.id === targetHandleId)!;
                    const inputType = targetFn.definition.inputDefaults.get(targetHandleId)!;

                    const error = simpleError(outputType, inputType);
                    if (error) {
                        return invalid(
                            `Input ${input.label} requires ${error.definition} but would be connected with ${error.assigned}.`
                        );
                    }

                    const traceTree = generateAssignmentErrorTrace(outputType, inputType);
                    if (!traceTree) throw new Error('Cannot determine assignment error');
                    const trace = printErrorTrace(traceTree);
                    return invalid(
                        `Input ${
                            input.label
                        } cannot be connected with an incompatible value. ${trace.join(' ')}`
                    );
                }

                const checkTargetChildren = (parentNode: Node<NodeData>): boolean => {
                    const targetChildren = getOutgoers(parentNode, getNodes(), getEdges());
                    if (!targetChildren.length) {
                        return false;
                    }
                    return targetChildren.some((childNode) => {
                        if (childNode.id === sourceNode.id) {
                            return true;
                        }
                        return checkTargetChildren(childNode);
                    });
                };
                const isLoop = checkTargetChildren(targetNode);
                if (isLoop) return invalid('Connection would create an infinite loop.');

                const iteratorLock =
                    !sourceNode.parentNode || sourceNode.parentNode === targetNode.parentNode;

                if (!iteratorLock) {
                    return invalid('Cannot create a connection to/from an iterator in this way.');
                }

                return VALID;
            },
            [typeState.functions, getNode, getNodes, getEdges, schemata]
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

                    const nodeCopy = copyNode(old);
                    nodeCopy.data.inputData = {
                        ...nodeCopy.data.inputData,
                        [inputId]: value,
                    };
                    return nodeCopy;
                });
                addInputDataChanges();
            },
            [modifyNode, addInputDataChanges]
        );

        const useInputSize = useCallback(
            (
                id: string,
                inputId: InputId,
                inputSize: InputSize | undefined
            ): readonly [Readonly<Size> | undefined, (size: Readonly<Size>) => void] => {
                const currentSize = inputSize?.[inputId];
                const setInputSize = (size: Readonly<Size>) => {
                    modifyNode(id, (old) => {
                        const nodeCopy = copyNode(old);
                        nodeCopy.data.inputSize = {
                            ...nodeCopy.data.inputSize,
                            [inputId]: size,
                        };
                        return nodeCopy;
                    });
                };
                return [currentSize, setInputSize] as const;
            },
            [modifyNode]
        );

        const [animatedNodes, setAnimatedNodes] = useState<ReadonlySet<string>>(EMPTY_SET);
        const animate = useCallback(
            (nodes: Iterable<string>, animateEdges = true): void => {
                const ids = new Set(nodes);
                setAnimatedNodes((prev) => {
                    const newSet = new Set(prev);
                    for (const id of ids) {
                        newSet.add(id);
                    }
                    return newSet;
                });
                if (animateEdges) {
                    setEdgesRef.current((edges) => {
                        return edges.map((e) => {
                            if (!ids.has(e.source)) return e;
                            return e.animated ? e : { ...e, animated: true };
                        });
                    });
                }
            },
            [setAnimatedNodes]
        );
        const unAnimate = useCallback(
            (nodes?: Iterable<string>): void => {
                if (nodes) {
                    const ids = new Set(nodes);
                    setAnimatedNodes((prev) => {
                        const newSet = new Set(prev);
                        for (const id of ids) {
                            newSet.delete(id);
                        }
                        return newSet;
                    });
                    setEdgesRef.current((edges) => {
                        return edges.map((e) => {
                            if (!ids.has(e.source)) return e;
                            return e.animated ? { ...e, animated: false } : e;
                        });
                    });
                } else {
                    setAnimatedNodes(EMPTY_SET);
                    setEdgesRef.current((edges) =>
                        edges.map((e) => (e.animated ? { ...e, animated: false } : e))
                    );
                }
            },
            [setAnimatedNodes]
        );

        const toggleNodeLock = useCallback(
            (id: string) => {
                modifyNode(id, (old) => {
                    const isLocked = old.data.isLocked ?? false;
                    const newNode = copyNode(old);
                    newNode.draggable = isLocked;
                    newNode.connectable = isLocked;
                    newNode.data.isLocked = !isLocked;
                    return newNode;
                });
            },
            [modifyNode]
        );

        const isNodeInputLocked = useCallback(
            (id: string, inputId: InputId): boolean => {
                return getEdges().some(
                    (e) =>
                        e.target === id &&
                        !!e.targetHandle &&
                        parseTargetHandle(e.targetHandle).inputId === inputId
                );
            },
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [edgeChanges, getEdges]
        );

        const setIteratorSize = useCallback(
            (id: string, size: IteratorSize) => {
                modifyNode(id, (old) => {
                    const newNode = copyNode(old);
                    newNode.data.iteratorSize = size;
                    return newNode;
                });
            },
            [modifyNode]
        );

        // TODO: this can probably be cleaned up but its good enough for now
        const updateIteratorBounds = useCallback(
            (id: string, iteratorSize: IteratorSize | null, dimensions?: Size) => {
                changeNodes((nodes) => {
                    const nodesToUpdate = nodes.filter((n) => n.parentNode === id);
                    const iteratorNode = nodes.find((n) => n.id === id);
                    if (iteratorNode && nodesToUpdate.length > 0) {
                        const { width, height, offsetTop, offsetLeft } =
                            iteratorSize === null ? iteratorNode.data.iteratorSize! : iteratorSize;
                        let minWidth = 256;
                        let minHeight = 256;
                        nodesToUpdate.forEach((n) => {
                            minWidth = Math.max(n.width ?? dimensions?.width ?? minWidth, minWidth);
                            minHeight = Math.max(
                                n.height ?? dimensions?.height ?? minHeight,
                                minHeight
                            );
                        });
                        const newNodes = nodesToUpdate.map((n) => {
                            const newNode = copyNode(n);
                            const wBound = width - (n.width ?? dimensions?.width ?? 0) + offsetLeft;
                            const hBound =
                                height - (n.height ?? dimensions?.height ?? 0) + offsetTop;
                            newNode.extent = [
                                [offsetLeft, offsetTop],
                                [wBound, hBound],
                            ];
                            newNode.position.x = Math.min(
                                Math.max(newNode.position.x, offsetLeft),
                                wBound
                            );
                            newNode.position.y = Math.min(
                                Math.max(newNode.position.y, offsetTop),
                                hBound
                            );
                            return newNode;
                        });

                        const newIteratorNode = copyNode(iteratorNode);

                        newIteratorNode.data.minWidth = minWidth;
                        newIteratorNode.data.minHeight = minHeight;
                        // TODO: prove that those non-null assertions are valid or make them unnecessary
                        newIteratorNode.data.iteratorSize!.width =
                            width < minWidth ? minWidth : width;
                        newIteratorNode.data.iteratorSize!.height =
                            height < minHeight ? minHeight : height;
                        return [
                            newIteratorNode,
                            ...nodes.filter((n) => n.parentNode !== id && n.id !== id),
                            ...newNodes,
                        ];
                    }

                    return nodes;
                });
            },
            [changeNodes]
        );

        const setIteratorPercent = useCallback(
            (id: string, percent: number) => {
                rfSetNodes((nodes) => {
                    const foundNode = nodes.find((n) => n.id === id);
                    if (foundNode) {
                        const newNode = copyNode(foundNode);
                        newNode.data.percentComplete = percent;
                        return [...nodes.filter((n) => n.id !== id), newNode];
                    }
                    return nodes;
                });
            },
            [rfSetNodes]
        );

        const duplicateNodes = useCallback(
            (ids: readonly string[]) => {
                const nodesToCopy = expandSelection(getNodes(), ids);

                const duplicationId = createUniqueId();
                const deriveId = (oldId: string) =>
                    nodesToCopy.has(oldId) ? deriveUniqueId(duplicationId + oldId) : oldId;

                changeNodes((nodes) => {
                    const newNodes = copyNodes(
                        nodes.filter((n) => nodesToCopy.has(n.id)),
                        deriveId,
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
                    return [...setSelected(edges, false), ...newEdge];
                });
            },
            [getNodes, changeNodes, changeEdges]
        );

        const clearNodes = useCallback(
            (ids: readonly string[]) => {
                ids.forEach((id) => {
                    modifyNode(id, (old) => {
                        const newNode = copyNode(old);
                        newNode.data.inputData = schemata.getDefaultInput(old.data.schemaId);
                        return newNode;
                    });
                    outputDataActions.delete(id);
                    addInputDataChanges();
                    backend.clearNodeCacheIndividual(id).catch((error) => log.error(error));
                });
            },
            [modifyNode, addInputDataChanges, outputDataActions, backend, schemata]
        );

        const setNodeDisabled = useCallback(
            (id: string, isDisabled: boolean): void => {
                modifyNode(id, (n) => {
                    const newNode = copyNode(n);
                    newNode.data.isDisabled = isDisabled;
                    return newNode;
                });
            },
            [modifyNode]
        );

        const cutFn = useCallback(() => {
            cutAndCopyToClipboard(getNodes(), getEdges(), changeNodes, changeEdges);
        }, [getNodes, getEdges, changeNodes, changeEdges]);
        const copyFn = useCallback(() => {
            copyToClipboard(getNodes(), getEdges());
        }, [getNodes, getEdges]);
        const pasteFn = useCallback(() => {
            pasteFromClipboard(changeNodes, changeEdges, createNode, project, reactFlowWrapper);
        }, [changeNodes, changeEdges, createNode, project, reactFlowWrapper]);
        const selectAllFn = useCallback(() => {
            changeNodes((nodes) => nodes.map((n) => ({ ...n, selected: true })));
            changeEdges((edges) => edges.map((e) => ({ ...e, selected: true })));
        }, [changeNodes, changeEdges]);
        const duplFn = useCallback(() => {
            const nodesToCopy = getNodes().filter((n) => n.selected);
            duplicateNodes(nodesToCopy.map((n) => n.id));
        }, [getNodes, duplicateNodes]);

        useHotkeys('ctrl+x, cmd+x', cutFn);
        useIpcRendererListener('cut', cutFn);
        useHotkeys('ctrl+c, cmd+c', copyFn);
        useIpcRendererListener('copy', copyFn);
        useHotkeys('ctrl+v, cmd+v', pasteFn);
        useIpcRendererListener('paste', pasteFn);
        useHotkeys('ctrl+a, cmd+a', selectAllFn);
        useHotkeys('ctrl+d, cmd+d', duplFn);

        const [zoom, setZoom] = useState(1);

        const [connectingFrom, setConnectingFrom] = useState<OnConnectStartParams | null>(null);

        const getNodesBoundingBox = useCallback(() => {
            const nodes = getNodes().filter((n) => !n.parentNode);

            if (nodes.length === 0) return;

            const minX = Math.min(...nodes.map((n) => n.position.x));
            const minY = Math.min(...nodes.map((n) => n.position.y));
            const maxX = Math.max(...nodes.map((n) => n.position.x + (n.width ?? 0)));
            const maxY = Math.max(...nodes.map((n) => n.position.y + (n.height ?? 0)));

            return {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
            };
        }, [getNodes]);

        const downloadImage = (dataUrl: string, fileName: string) => {
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        const [viewportExportPadding] = useViewportExportPadding;
        const exportViewportScreenshot = useCallback(() => {
            const currentFlowWrapper = reactFlowWrapper.current;
            if (!(currentFlowWrapper instanceof HTMLElement)) return;

            const oldViewport = currentReactFlowInstance.getViewport();

            const reactFlowViewport = currentFlowWrapper.getBoundingClientRect();
            const nodesBoundingBox = getNodesBoundingBox();

            if (!nodesBoundingBox) return;

            const paddedBoundingBox = {
                x: nodesBoundingBox.x - viewportExportPadding,
                y: nodesBoundingBox.y - viewportExportPadding,
                width: nodesBoundingBox.width + viewportExportPadding * 2,
                height: nodesBoundingBox.height + viewportExportPadding * 2,
            };

            const exportZoom = Math.min(
                reactFlowViewport.width / paddedBoundingBox.width,
                reactFlowViewport.height / paddedBoundingBox.height
            );

            currentReactFlowInstance.setViewport({
                x: paddedBoundingBox.x * -1 * exportZoom,
                y: paddedBoundingBox.y * -1 * exportZoom,
                zoom: exportZoom,
            });

            // wait for the viewport to be updated
            setTimeout(() => {
                toPng(currentFlowWrapper, {
                    style: {
                        padding: '0',
                        margin: '0',
                        pointerEvents: 'none',
                    },
                    pixelRatio: 1 / exportZoom,
                    width: paddedBoundingBox.width * exportZoom,
                    height: paddedBoundingBox.height * exportZoom,
                    filter: (node: unknown) => {
                        if (
                            node instanceof HTMLElement &&
                            (node.classList.contains('react-flow__minimap') ||
                                node.classList.contains('react-flow__controls'))
                        ) {
                            return false;
                        }

                        return true;
                    },
                })
                    .then((dataUrl: string) => {
                        currentReactFlowInstance.setViewport(oldViewport);

                        const currentChainName = savePath ? parse(savePath).name : 'Untitled';

                        const date = new Date();
                        const dateString = `${date.getFullYear()}-${
                            date.getMonth() + 1
                        }-${date.getDate()}`;

                        const hourString = date.getHours().toString().padStart(2, '0');
                        const minuteString = date.getMinutes().toString().padStart(2, '0');
                        const timeString = `${hourString}-${minuteString}`;

                        const fileName = `chaiNNer-${currentChainName}-${dateString}_${timeString}.png`;
                        downloadImage(dataUrl, fileName);
                    })
                    .catch((error) => {
                        log.error(error);
                    });
            }, 10);
        }, [
            reactFlowWrapper,
            currentReactFlowInstance,
            getNodesBoundingBox,
            viewportExportPadding,
            savePath,
        ]);

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
            isNodeInputLocked,
            effectivelyDisabledNodes,
            isValidConnection,
            zoom,
            hoveredNode,
            collidingEdge,
            collidingNode,
            isAnimated: useCallback((nodeId) => animatedNodes.has(nodeId), [animatedNodes]),
            inputHashes: inputHashesRef.current,
            outputDataMap,
            useConnectingFrom: useMemoArray([connectingFrom, setConnectingFrom] as const),
        });

        const globalValue = useMemoObject<Global>({
            reactFlowWrapper,
            defaultIteratorSize,
            setNodesRef,
            setEdgesRef,
            addNodeChanges,
            addEdgeChanges,
            changeNodes,
            changeEdges,
            selectNode,
            animate,
            unAnimate,
            createNode,
            createConnection,
            getNodeInputValue,
            setNodeInputValue,
            useInputSize,
            toggleNodeLock,
            clearNodes,
            removeNodesById,
            removeEdgeById,
            duplicateNodes,
            updateIteratorBounds,
            setIteratorPercent,
            setIteratorSize,
            setHoveredNode,
            setCollidingEdge,
            setCollidingNode,
            setNodeDisabled,
            setZoom,
            exportViewportScreenshot,
            setManualOutputType,
            typeStateRef,
            releaseNodeFromParent,
            outputDataActions,
            getInputHash,
            hasRelevantUnsavedChangesRef,
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
