import log from 'electron-log';
import { dirname } from 'path';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
    Connection,
    Edge,
    Node,
    OnConnectStartParams,
    Viewport,
    XYPosition,
    getOutgoers,
    useReactFlow,
} from 'react-flow-renderer';
import { useHotkeys } from 'react-hotkeys-hook';
import { createContext, useContext } from 'use-context-selector';
import {
    EdgeData,
    InputData,
    InputValue,
    IteratorSize,
    Mutable,
    NodeData,
    SchemaId,
    Size,
} from '../../common/common-types';
import { ipcRenderer } from '../../common/safeIpc';
import { ParsedSaveData, SaveData, openSaveFile } from '../../common/SaveFile';
import { SchemaMap } from '../../common/SchemaMap';
import { evaluate } from '../../common/types/evaluate';
import { Expression } from '../../common/types/expression';
import { FunctionDefinition } from '../../common/types/function';
import { TypeDefinitions } from '../../common/types/typedef';
import { Type } from '../../common/types/types';
import { createUniqueId, deriveUniqueId, parseHandle } from '../../common/util';
import {
    copyToClipboard,
    cutAndCopyToClipboard,
    pasteFromClipboard,
} from '../helpers/copyAndPaste';
import { getEffectivelyDisabledNodes } from '../helpers/disabled';
import {
    copyEdges,
    copyNode,
    copyNodes,
    expandSelection,
    setSelected,
} from '../helpers/reactFlowUtil';
import { TypeState } from '../helpers/TypeState';
import { useAsyncEffect } from '../hooks/useAsyncEffect';
import { ChangeCounter, useChangeCounter, wrapChanges } from '../hooks/useChangeCounter';
import { useIpcRendererListener } from '../hooks/useIpcRendererListener';
import { useOpenRecent } from '../hooks/useOpenRecent';
import useSessionStorage, { getSessionStorageOrDefault } from '../hooks/useSessionStorage';
import { AlertBoxContext, AlertType } from './AlertBoxContext';
import { SettingsContext } from './SettingsContext';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

interface GlobalVolatile {
    nodeChanges: ChangeCounter;
    edgeChanges: ChangeCounter;
    typeState: TypeState;
    createNode: (proto: NodeProto) => void;
    createConnection: (connection: Connection) => void;
    isNodeInputLocked: (id: string, inputId: number) => boolean;
    isValidConnection: (connection: Readonly<Connection>) => boolean;
    effectivelyDisabledNodes: ReadonlySet<string>;
    zoom: number;
    hoveredNode: string | null | undefined;
    useConnectingFromType: [Type | null, SetState<Type | null>];
    useConnectingFrom: [OnConnectStartParams | null, SetState<OnConnectStartParams | null>];
}
interface Global {
    schemata: SchemaMap;
    reactFlowWrapper: React.RefObject<Element>;
    defaultIteratorSize: Size;
    setSetNodes: SetState<SetState<Node<NodeData>[]>>;
    setSetEdges: SetState<SetState<Edge<EdgeData>[]>>;
    addNodeChanges: () => void;
    addEdgeChanges: () => void;
    changeNodes: SetState<Node<NodeData>[]>;
    changeEdges: SetState<Edge<EdgeData>[]>;
    useAnimateEdges: () => readonly [
        (nodeIdsToAnimate?: readonly string[] | undefined) => void,
        (nodeIdsToUnAnimate?: readonly string[] | undefined) => void,
        (finished: readonly string[]) => void,
        () => void
    ];
    useInputData: <T extends NonNullable<InputValue>>(
        id: string,
        inputId: number,
        inputData: InputData
    ) => readonly [T | undefined, (data: T) => void];
    removeNodeById: (id: string) => void;
    removeEdgeById: (id: string) => void;
    duplicateNode: (id: string) => void;
    toggleNodeLock: (id: string) => void;
    clearNode: (id: string) => void;
    setIteratorSize: (id: string, size: IteratorSize) => void;
    updateIteratorBounds: (
        id: string,
        iteratorSize: IteratorSize | null,
        dimensions?: Size
    ) => void;
    setIteratorPercent: (id: string, percent: number) => void;
    setNodeDisabled: (id: string, isDisabled: boolean) => void;
    setHoveredNode: SetState<string | null | undefined>;
    setZoom: SetState<number>;
    setManualOutputType: (nodeId: string, outputId: number, type: Expression | undefined) => void;
    functionDefinitions: Map<SchemaId, FunctionDefinition>;
    typeDefinitions: TypeDefinitions;
}

export interface NodeProto {
    id?: string;
    position: Readonly<XYPosition>;
    data: Omit<NodeData, 'id' | 'inputData'> & { inputData?: InputData };
    nodeType: string;
}

// TODO: Find default
export const GlobalVolatileContext = createContext<Readonly<GlobalVolatile>>({} as GlobalVolatile);
export const GlobalContext = createContext<Readonly<Global>>({} as Global);

const createNodeImpl = (
    { id = createUniqueId(), position, data, nodeType }: NodeProto,
    schemata: SchemaMap,
    parent?: Node<NodeData>,
    selected = false
): Node<NodeData>[] => {
    const newNode: Node<Mutable<NodeData>> = {
        type: nodeType,
        id,
        position: { ...position },
        data: {
            ...data,
            id,
            inputData: data.inputData ?? schemata.getDefaultInput(data.schemaId),
        },
        selected,
    };

    if (parent && parent.type === 'iterator' && nodeType !== 'iterator') {
        const { width, height, offsetTop, offsetLeft } = parent.data.iteratorSize ?? {
            width: 1280,
            height: 720,
            offsetTop: 0,
            offsetLeft: 0,
        };
        newNode.position.x = position.x - parent.position.x;
        newNode.position.y = position.y - parent.position.y;
        newNode.parentNode = parent.id;
        newNode.data.parentNode = parent.id;
        newNode.extent = [
            [offsetLeft, offsetTop],
            [width, height],
        ];
    }

    const extraNodes: Node<NodeData>[] = [];
    if (nodeType === 'iterator') {
        newNode.data.iteratorSize = {
            width: 1280,
            height: 720,
            offsetTop: 0,
            offsetLeft: 0,
        };

        const { defaultNodes = [] } = schemata.get(data.schemaId);

        defaultNodes.forEach(({ schemaId }) => {
            const schema = schemata.get(schemaId);
            const subNode = createNodeImpl(
                {
                    nodeType: schema.nodeType,
                    position: newNode.position,
                    data: {
                        schemaId,
                    },
                },
                schemata,
                newNode
            );
            extraNodes.push(...subNode);
        });
    }

    return [newNode, ...extraNodes];
};

const defaultIteratorSize: Size = { width: 1280, height: 720 };

interface GlobalProviderProps {
    schemata: SchemaMap;
    reactFlowWrapper: React.RefObject<Element>;
    functionDefinitions: Map<SchemaId, FunctionDefinition>;
    typeDefinitions: TypeDefinitions;
}

const EMPTY_SET: ReadonlySet<never> = new Set();

export const GlobalProvider = memo(
    ({
        children,
        schemata,
        reactFlowWrapper,
        functionDefinitions,

        typeDefinitions,
    }: React.PropsWithChildren<GlobalProviderProps>) => {
        const { sendAlert, sendToast, showAlert } = useContext(AlertBoxContext);
        const { useStartupTemplate } = useContext(SettingsContext);

        const [nodeChanges, addNodeChanges] = useChangeCounter();
        const [edgeChanges, addEdgeChanges] = useChangeCounter();
        const {
            setViewport,
            getViewport,
            getNode,
            getNodes,
            getEdges,
            setNodes: rfSetNodes,
            setEdges: rfSetEdges,
        } = useReactFlow<NodeData, EdgeData>();

        const [setNodes, setSetNodes] = useState(() => rfSetNodes);
        const [setEdges, setSetEdges] = useState(() => rfSetEdges);

        const changeNodes = useMemo(
            () => wrapChanges(setNodes, addNodeChanges),
            [setNodes, addNodeChanges]
        );
        const changeEdges = useMemo(
            () => wrapChanges(setEdges, addEdgeChanges),
            [setEdges, addEdgeChanges]
        );

        const [manualOutputTypes, setManualOutputTypes] = useState(() => ({
            map: new Map<string, Map<number, Type>>(),
        }));
        const setManualOutputType = useCallback(
            (nodeId: string, outputId: number, type: Expression | undefined): void => {
                setManualOutputTypes(({ map }) => {
                    let inner = map.get(nodeId);
                    if (type) {
                        if (!inner) {
                            inner = new Map();
                            map.set(nodeId, inner);
                        }

                        inner.set(outputId, evaluate(type, typeDefinitions));
                    } else {
                        inner?.delete(outputId);
                    }
                    return { map };
                });
            },
            [setManualOutputTypes, typeDefinitions]
        );

        const [typeState, setTypeState] = useState(TypeState.empty);
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
            }, 100);
            return () => clearTimeout(timerId);
        }, [nodeChanges, edgeChanges, manualOutputTypes, functionDefinitions]);

        // Cache node state to avoid clearing state when refreshing
        useEffect(() => {
            const timerId = setTimeout(() => {
                sessionStorage.setItem('cachedNodes', JSON.stringify(getNodes()));
                sessionStorage.setItem('cachedEdges', JSON.stringify(getEdges()));
                sessionStorage.setItem('cachedViewport', JSON.stringify(getViewport()));
            }, 100);
            return () => clearTimeout(timerId);
        }, [nodeChanges, edgeChanges]);
        useEffect(() => {
            const cachedNodes = getSessionStorageOrDefault<Node<NodeData>[]>('cachedNodes', []);
            const cachedEdges = getSessionStorageOrDefault<Edge<EdgeData>[]>('cachedEdges', []);
            const cachedViewport = getSessionStorageOrDefault<Viewport | null>(
                'cachedViewport',
                null
            );

            changeNodes(cachedNodes);
            changeEdges(cachedEdges);
            if (cachedViewport) setViewport(cachedViewport);
        }, [changeNodes, changeEdges]);

        const [effectivelyDisabledNodes, setEffectivelyDisabledNodes] =
            useState<ReadonlySet<string>>(EMPTY_SET);
        useEffect(() => {
            const newEffectivelyDisabled = getEffectivelyDisabledNodes(getNodes(), getEdges())
                .map((n) => n.id)
                .sort();
            const newKey = newEffectivelyDisabled.join(';');
            const oldKey = [...effectivelyDisabledNodes].join(';');
            if (oldKey !== newKey) {
                setEffectivelyDisabledNodes(new Set(newEffectivelyDisabled));
            }
        }, [edgeChanges, nodeChanges, getNodes, getEdges]);

        const [savePath, setSavePathInternal] = useState<string | undefined>();
        const [openRecent, pushOpenPath, removeRecentPath] = useOpenRecent();
        const setSavePath = useCallback(
            (path: string | undefined) => {
                setSavePathInternal(path);
                if (path) pushOpenPath(path);
            },
            [setSavePathInternal, pushOpenPath]
        );

        const [hoveredNode, setHoveredNode] = useState<string | null | undefined>(null);

        const [hasUnsavedChanges, setHasUnsavedChanges] = useState(true);
        /**
         * Whether the current chain as *relevant* unsaved changes.
         *
         * Some changes to the chain might not be worth saving (e.g. animation status).
         */
        const [hasRelevantUnsavedChanges, setHasRelevantUnsavedChanges] = useState(false);
        useEffect(() => {
            const value = hasUnsavedChanges && (getNodes().length > 0 || !!savePath);
            setHasRelevantUnsavedChanges(value);
            ipcRenderer.send('update-has-unsaved-changes', value);
        }, [hasUnsavedChanges, savePath, nodeChanges]);

        useEffect(() => {
            setHasUnsavedChanges(true);
        }, [nodeChanges, edgeChanges]);
        useEffect(() => {
            const id = setTimeout(() => {
                const dot = hasRelevantUnsavedChanges ? ' •' : '';
                document.title = `chaiNNer - ${savePath || 'Untitled'}${dot}`;
            }, 200);
            return () => clearTimeout(id);
        }, [savePath, hasRelevantUnsavedChanges]);

        const unsavedChangesWarning = {
            type: AlertType.WARN,
            title: 'Discard unsaved changes?',
            message:
                'The current chain has some unsaved changes. Do you really want to discard those changes?',
            buttons: ['Discard changes', 'No'],
            defaultButton: 1,
        };

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
        }, [getNodes, getEdges]);

        const setStateFromJSON = useCallback(
            async (savedData: ParsedSaveData, path: string, loadPosition = false) => {
                if (hasRelevantUnsavedChanges) {
                    const resp = await showAlert(unsavedChangesWarning);
                    if (resp === 1) {
                        // abort
                        return;
                    }
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
                changeNodes(validNodes);
                changeEdges(validEdges);
                if (loadPosition) {
                    setViewport(savedData.viewport);
                }
                setSavePath(path);
                pushOpenPath(path);
                setHasUnsavedChanges(false);
            },
            [hasRelevantUnsavedChanges, schemata, changeNodes, changeEdges]
        );

        const clearState = useCallback(async () => {
            if (hasRelevantUnsavedChanges) {
                const resp = await showAlert(unsavedChangesWarning);
                if (resp === 1) {
                    // abort
                    return;
                }
            }

            changeNodes([]);
            changeEdges([]);
            setSavePath(undefined);
            setViewport({ x: 0, y: 0, zoom: 1 });
        }, [hasRelevantUnsavedChanges, changeNodes, changeEdges, setSavePath, setViewport]);

        const performSave = useCallback(
            (saveAs: boolean) => {
                (async () => {
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
                            if (result.kind === 'Canceled') return;
                            setSavePath(result.path);
                        }

                        setHasUnsavedChanges(false);
                    } catch (error) {
                        log.error(error);

                        sendToast({
                            status: 'error',
                            duration: 10_000,
                            description: `Failed to save chain`,
                        });
                    }
                })();
            },
            [dumpState, savePath, openRecent]
        );

        // Register New File event handler
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        useIpcRendererListener('file-new', () => clearState(), [clearState]);

        useAsyncEffect(async () => {
            const result = await ipcRenderer.invoke('get-cli-open');
            if (result) {
                if (result.kind === 'Success') {
                    await setStateFromJSON(result.saveData, result.path, true);
                } else {
                    removeRecentPath(result.path);
                    sendAlert({
                        type: AlertType.ERROR,
                        message: `Unable to open file ${result.path}`,
                    });
                }
            }
        }, [setStateFromJSON, removeRecentPath]);

        // Register Open File event handler
        useIpcRendererListener(
            'file-open',
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            async (event, result) => {
                if (result.kind === 'Success') {
                    await setStateFromJSON(result.saveData, result.path, true);
                } else {
                    removeRecentPath(result.path);
                    sendAlert({
                        type: AlertType.ERROR,
                        message: `Unable to open file ${result.path}`,
                    });
                }
            },
            [setStateFromJSON, removeRecentPath]
        );

        // Register Save/Save-As event handlers
        useIpcRendererListener('file-save-as', () => performSave(true), [performSave]);
        useIpcRendererListener('file-save', () => performSave(false), [performSave]);

        const [firstLoad, setFirstLoad] = useSessionStorage('firstLoad', true);
        const [startupTemplate] = useStartupTemplate;
        useAsyncEffect(async () => {
            if (firstLoad && startupTemplate) {
                try {
                    const saveFile = await openSaveFile(startupTemplate);
                    if (saveFile.kind === 'Success') {
                        await setStateFromJSON(saveFile.saveData, '', true);
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
        }, [firstLoad]);

        const removeNodeById = useCallback(
            (id: string) => {
                changeEdges((edges) => edges.filter((e) => e.source !== id && e.target !== id));
                changeNodes((nodes) => {
                    const node = nodes.find((n) => n.id === id);
                    if (node && node.type !== 'iteratorHelper') {
                        return nodes.filter((n) => n.id !== id && n.parentNode !== id);
                    }
                    return nodes;
                });
            },
            [changeNodes, changeEdges]
        );

        const removeEdgeById = useCallback(
            (id: string) => {
                changeEdges((edges) => edges.filter((e) => e.id !== id));
            },
            [changeEdges]
        );

        const createNode = useCallback(
            (proto: NodeProto): void => {
                changeNodes((nodes) => {
                    const parent = hoveredNode
                        ? nodes.find((n) => n.id === hoveredNode)
                        : undefined;
                    const newNodes = createNodeImpl(proto, schemata, parent, true);
                    return [
                        ...nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
                        ...newNodes,
                    ];
                });
            },
            [changeNodes, schemata, hoveredNode]
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

        const isValidConnection = useCallback(
            ({ target, targetHandle, source, sourceHandle }: Readonly<Connection>) => {
                if (source === target || !source || !target || !sourceHandle || !targetHandle) {
                    return false;
                }
                const sourceHandleId = parseHandle(sourceHandle).inOutId;
                const targetHandleId = parseHandle(targetHandle).inOutId;

                const sourceFn = typeState.functions.get(source);
                const targetFn = typeState.functions.get(target);

                if (!sourceFn || !targetFn) {
                    return false;
                }

                const outputType = sourceFn.outputs.get(sourceHandleId);
                if (outputType !== undefined && !targetFn.canAssign(targetHandleId, outputType))
                    return false;

                const sourceNode = getNode(source);
                const targetNode = getNode(target);
                if (!sourceNode || !targetNode) {
                    return false;
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
                if (isLoop) return false;

                const iteratorLock =
                    !sourceNode.parentNode || sourceNode.parentNode === targetNode.parentNode;

                return iteratorLock;
            },
            [getNode, getNodes, getEdges, typeState]
        );

        const useInputData = useCallback(
            // eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions, func-names
            function <T extends NonNullable<InputValue>>(
                id: string,
                inputId: number,
                inputData: InputData
            ): readonly [T | undefined, (data: T) => void] {
                const currentInput = (inputData[inputId] ?? undefined) as T | undefined;
                const setInputData = (data: T) => {
                    // This is a action that might be called asynchronously, so we cannot rely on of
                    // the captured data from `nodes` to be up-to-date anymore. For that reason, we
                    // must derive any changes to nodes from the previous value passed to us by
                    // `setNodes`.

                    modifyNode(id, (old) => {
                        const nodeCopy = copyNode(old);
                        nodeCopy.data.inputData = {
                            ...nodeCopy.data.inputData,
                            [inputId]: data,
                        };
                        return nodeCopy;
                    });
                };
                return [currentInput, setInputData] as const;
            },
            [modifyNode, schemata]
        );

        const useAnimateEdges = useCallback(() => {
            const setAnimated = (animated: boolean, nodeIdsToAnimate?: readonly string[]) => {
                setEdges((edges) => {
                    if (nodeIdsToAnimate) {
                        const edgesToAnimate = edges.filter((e) =>
                            nodeIdsToAnimate.includes(e.source)
                        );
                        const animatedEdges = edgesToAnimate.map((edge) => ({ ...edge, animated }));
                        const otherEdges = edges.filter(
                            (e) => !nodeIdsToAnimate.includes(e.source)
                        );
                        return [...otherEdges, ...animatedEdges];
                    }
                    return edges.map((edge) => ({ ...edge, animated }));
                });
            };

            const animateEdges = (nodeIdsToAnimate?: readonly string[]) =>
                setAnimated(true, nodeIdsToAnimate);

            const unAnimateEdges = (nodeIdsToUnAnimate?: readonly string[]) =>
                setAnimated(false, nodeIdsToUnAnimate);

            const completeEdges = (finished: readonly string[]) => {
                setEdges((edges) =>
                    edges.map((edge): Edge<EdgeData> => {
                        const complete = finished.includes(edge.source);
                        return {
                            ...edge,
                            animated: !complete,
                        };
                    })
                );
            };

            const clearCompleteEdges = () => {
                setEdges((edges) =>
                    edges.map((edge): Edge<EdgeData> => {
                        return {
                            ...edge,
                            animated: false,
                        };
                    })
                );
            };

            return [animateEdges, unAnimateEdges, completeEdges, clearCompleteEdges] as const;
        }, [setEdges]);

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
            (id: string, inputId: number): boolean => {
                return getEdges().some(
                    (e) =>
                        e.target === id &&
                        !!e.targetHandle &&
                        parseHandle(e.targetHandle).inOutId === inputId
                );
            },
            [edgeChanges]
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
                        let maxWidth = 256;
                        let maxHeight = 256;
                        nodesToUpdate.forEach((n) => {
                            maxWidth = Math.max(n.width ?? dimensions?.width ?? maxWidth, maxWidth);
                            maxHeight = Math.max(
                                n.height ?? dimensions?.height ?? maxHeight,
                                maxHeight
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

                        newIteratorNode.data.maxWidth = maxWidth;
                        newIteratorNode.data.maxHeight = maxHeight;
                        // TODO: prove that those non-null assertions are valid or make them unnecessary
                        newIteratorNode.data.iteratorSize!.width =
                            width < maxWidth ? maxWidth : width;
                        newIteratorNode.data.iteratorSize!.height =
                            height < maxHeight ? maxHeight : height;
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
                modifyNode(id, (old) => {
                    const newNode = copyNode(old);
                    newNode.data.percentComplete = percent;
                    return newNode;
                });
            },
            [modifyNode]
        );

        const duplicateNode = useCallback(
            (id: string) => {
                const nodesToCopy = expandSelection(getNodes(), [id]);

                const duplicationId = createUniqueId();
                const deriveId = (oldId: string) =>
                    nodesToCopy.has(oldId) ? deriveUniqueId(duplicationId + oldId) : oldId;

                changeNodes((nodes) => {
                    const newNodes = copyNodes(
                        nodes.filter((n) => nodesToCopy.has(n.id)),
                        deriveId,
                        deriveId
                    );
                    const derivedId = deriveId(id);
                    newNodes.forEach((n) => {
                        // eslint-disable-next-line no-param-reassign
                        n.selected = n.id === derivedId;
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

        const clearNode = useCallback(
            (id: string) => {
                modifyNode(id, (old) => {
                    const newNode = copyNode(old);
                    newNode.data.inputData = schemata.getDefaultInput(old.data.schemaId);
                    return newNode;
                });
            },
            [modifyNode]
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
            pasteFromClipboard(changeNodes, changeEdges);
        }, [changeNodes, changeEdges]);

        useHotkeys('ctrl+x, cmd+x', cutFn, [cutFn]);
        useIpcRendererListener('cut', cutFn, [cutFn]);
        useHotkeys('ctrl+c, cmd+c', copyFn, [copyFn]);
        useIpcRendererListener('copy', copyFn, [copyFn]);
        useHotkeys('ctrl+v, cmd+v', pasteFn, [pasteFn]);
        useIpcRendererListener('paste', pasteFn, [pasteFn]);

        const [zoom, setZoom] = useState(1);

        const [connectingFromType, setConnectingFromType] = useState<Type | null>(null);
        const [connectingFrom, setConnectingFrom] = useState<OnConnectStartParams | null>(null);

        // eslint-disable-next-line react/jsx-no-constructed-context-values
        let globalChainValue: GlobalVolatile = {
            nodeChanges,
            edgeChanges,
            typeState,
            createNode,
            createConnection,
            isNodeInputLocked,
            effectivelyDisabledNodes,
            isValidConnection,
            zoom,
            hoveredNode,
            useConnectingFromType: useMemo(
                () => [connectingFromType, setConnectingFromType],
                [connectingFromType, setConnectingFromType]
            ),
            useConnectingFrom: useMemo(
                () => [connectingFrom, setConnectingFrom],
                [connectingFrom, setConnectingFrom]
            ),
        };
        globalChainValue = useMemo(() => globalChainValue, Object.values(globalChainValue));

        // eslint-disable-next-line react/jsx-no-constructed-context-values
        let globalValue: Global = {
            schemata,
            reactFlowWrapper,
            defaultIteratorSize,
            setSetNodes,
            setSetEdges,
            addNodeChanges,
            addEdgeChanges,
            changeNodes,
            changeEdges,
            useAnimateEdges,
            useInputData,
            toggleNodeLock,
            clearNode,
            removeNodeById,
            removeEdgeById,
            duplicateNode,
            updateIteratorBounds,
            setIteratorPercent,
            setIteratorSize,
            setHoveredNode,
            setNodeDisabled,
            setZoom,
            setManualOutputType,
            functionDefinitions,
            typeDefinitions,
        };
        globalValue = useMemo(() => globalValue, Object.values(globalValue));

        return (
            <GlobalVolatileContext.Provider value={globalChainValue}>
                <GlobalContext.Provider value={globalValue}>{children}</GlobalContext.Provider>
                <div style={{ display: 'none' }}>
                    {nodeChanges};{edgeChanges}
                </div>
            </GlobalVolatileContext.Provider>
        );
    }
);
