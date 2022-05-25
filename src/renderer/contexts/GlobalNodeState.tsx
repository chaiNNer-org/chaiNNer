import { clipboard } from 'electron';
import log from 'electron-log';
import { dirname } from 'path';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Connection,
    Edge,
    Node,
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
    Size,
} from '../../common/common-types';
import { ipcRenderer } from '../../common/safeIpc';
import { ParsedSaveData, SaveData } from '../../common/SaveFile';
import { SchemaMap } from '../../common/SchemaMap';
import { createUniqueId, deriveUniqueId, parseHandle } from '../../common/util';
import { copyNode } from '../helpers/reactFlowUtil';
import { useAsyncEffect } from '../hooks/useAsyncEffect';
import { ChangeCounter, useChangeCounter, wrapChanges } from '../hooks/useChangeCounter';
import { useIpcRendererListener } from '../hooks/useIpcRendererListener';
import { useOpenRecent } from '../hooks/useOpenRecent';
import { getSessionStorageOrDefault } from '../hooks/useSessionStorage';
import { AlertBoxContext, AlertType } from './AlertBoxContext';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

interface GlobalVolatile {
    nodeChanges: ChangeCounter;
    edgeChanges: ChangeCounter;
    createNode: (proto: NodeProto) => void;
    createConnection: (connection: Connection) => void;
    isNodeInputLocked: (id: string, inputId: number) => boolean;
    zoom: number;
    hoveredNode: string | null | undefined;
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
    isValidConnection: (connection: Readonly<Connection>) => boolean;
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
    setHoveredNode: SetState<string | null | undefined>;
    setZoom: SetState<number>;
}

export interface NodeProto {
    position: Readonly<XYPosition>;
    data: Omit<NodeData, 'id' | 'inputData'> & { inputData?: InputData };
    nodeType: string;
}

// TODO: Find default
export const GlobalVolatileContext = createContext<Readonly<GlobalVolatile>>({} as GlobalVolatile);
export const GlobalContext = createContext<Readonly<Global>>({} as Global);

const createNodeImpl = (
    { position, data, nodeType }: NodeProto,
    schemata: SchemaMap,
    parent?: Node<NodeData>,
    selected = false
): Node<NodeData>[] => {
    const id = createUniqueId();
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
}

export const GlobalProvider = ({
    children,
    schemata,
    reactFlowWrapper,
}: React.PropsWithChildren<GlobalProviderProps>) => {
    const { sendAlert, sendToast, showAlert } = useContext(AlertBoxContext);

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
        const cachedViewport = getSessionStorageOrDefault<Viewport | null>('cachedViewport', null);

        changeNodes(cachedNodes);
        changeEdges(cachedEdges);
        if (cachedViewport) setViewport(cachedViewport);
    }, [changeNodes, changeEdges]);

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
                .filter((edge) => validNodeIds.has(edge.target) && validNodeIds.has(edge.source))
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

    const removeNodeById = useCallback(
        (id: string) => {
            changeNodes((nodes) => {
                const node = nodes.find((n) => n.id === id);
                if (node && node.type !== 'iteratorHelper') {
                    return nodes.filter((n) => n.id !== id && n.parentNode !== id);
                }
                return nodes;
            });
        },
        [changeNodes]
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
                const parent = hoveredNode ? nodes.find((n) => n.id === hoveredNode) : undefined;
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

            const sourceNode = getNode(source);
            const targetNode = getNode(target);
            if (!sourceNode || !targetNode) {
                return false;
            }

            // Target inputs, source outputs
            const { outputs } = schemata.get(sourceNode.data.schemaId);
            const { inputs } = schemata.get(targetNode.data.schemaId);

            const sourceOutput = outputs.find((o) => o.id === sourceHandleId)!;
            const targetInput = inputs.find((i) => i.id === targetHandleId)!;

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

            const iteratorLock =
                !sourceNode.parentNode || sourceNode.parentNode === targetNode.parentNode;

            return sourceOutput.type === targetInput.type && !isLoop && iteratorLock;
        },
        [schemata, getNode, getNodes, getEdges]
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
                    const edgesToAnimate = edges.filter((e) => nodeIdsToAnimate.includes(e.source));
                    const animatedEdges = edgesToAnimate.map((edge) => ({ ...edge, animated }));
                    const otherEdges = edges.filter((e) => !nodeIdsToAnimate.includes(e.source));
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
                        const hBound = height - (n.height ?? dimensions?.height ?? 0) + offsetTop;
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
                    newIteratorNode.data.iteratorSize!.width = width < maxWidth ? maxWidth : width;
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

    const copyNodesAndEdges = useCallback(
        (nodesToCopy: Set<string>, edgesToCopy: Set<string> | null) => {
            const duplicateId = createUniqueId();
            const deriveId = (oldId: string) => deriveUniqueId(duplicateId + oldId);

            changeNodes((nodes) => {
                const newNodes = nodes
                    .filter((n) => nodesToCopy.has(n.id) || nodesToCopy.has(n.parentNode!))
                    .map<Node<NodeData>>((n) => {
                        const newId = deriveId(n.id);
                        if (!n.parentNode) {
                            const returnData = {
                                ...n,
                                id: newId,
                                position: {
                                    x: (n.position.x || 0) + 200,
                                    y: (n.position.y || 0) + 200,
                                },
                                data: {
                                    ...n.data,
                                    id: newId,
                                },
                                selected: true,
                            };
                            delete returnData.handleBounds;
                            return returnData;
                        }

                        const parentId = deriveId(n.parentNode);
                        const returnData = {
                            ...n,
                            id: newId,
                            data: {
                                ...n.data,
                                id: newId,
                                parentNode: parentId,
                            },
                            parentNode: parentId,
                            selected: true,
                        };
                        delete returnData.handleBounds;
                        return returnData;
                    });
                return [...nodes.map((n) => ({ ...n, selected: false })), ...newNodes];
            });

            changeEdges((edges) => {
                const newEdges = edges
                    .filter((e) => {
                        const copyEdge = edgesToCopy ? edgesToCopy.has(e.id) : true;
                        return nodesToCopy.has(e.target) && nodesToCopy.has(e.source) && copyEdge;
                    })
                    .map<Edge<EdgeData>>((e) => {
                        let { source, sourceHandle, target, targetHandle } = e;
                        if (nodesToCopy.has(source)) {
                            source = deriveId(source);
                            sourceHandle = sourceHandle?.replace(e.source, source);
                        }
                        target = deriveId(target);
                        targetHandle = targetHandle?.replace(e.target, target);
                        return {
                            ...e,
                            id: createUniqueId(),
                            source,
                            sourceHandle,
                            target,
                            targetHandle,
                            selected: true,
                        };
                    });
                return [...edges.map((e) => ({ ...e, selected: false })), ...newEdges];
            });
        },
        [changeNodes, changeEdges]
    );

    const duplicateNode = useCallback(
        (id: string) => {
            const nodesToCopy = new Set([
                id,
                ...getNodes()
                    .filter((n) => n.parentNode === id)
                    .map((n) => n.id),
            ]);
            copyNodesAndEdges(nodesToCopy, null);
        },
        [getNodes, copyNodesAndEdges]
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

    interface ClipboardChain {
        nodes: Node[];
        edges: Edge[];
    }

    useHotkeys(
        'ctrl+c, cmd+c',
        () => {
            const selectedNodes = getNodes().filter((n) => n.selected);
            const selectedEdges = getEdges().filter((e) => e.selected);
            const data: ClipboardChain = { nodes: selectedNodes, edges: selectedEdges };
            const copyData = Buffer.from(JSON.stringify(data));
            clipboard.writeBuffer('application/chainner.chain', copyData, 'clipboard');
        },
        [getNodes]
    );

    useHotkeys(
        'ctrl+v, cmd+v',
        () => {
            const { nodes, edges } = JSON.parse(
                clipboard.readBuffer('application/chainner.chain').toString()
            ) as ClipboardChain;
            if (nodes.length > 0) {
                const nodesToCopy = new Set(nodes.map((n) => n.id));
                const edgesToCopy = edges.length > 0 ? new Set(edges.map((e) => e.id)) : null;
                copyNodesAndEdges(nodesToCopy, edgesToCopy);
            }
        },
        [copyNodesAndEdges]
    );

    const [zoom, setZoom] = useState(1);

    let globalChainValue: GlobalVolatile = {
        nodeChanges,
        edgeChanges,
        createNode,
        createConnection,
        isNodeInputLocked,
        zoom,
        hoveredNode,
    };
    globalChainValue = useMemo(() => globalChainValue, Object.values(globalChainValue));

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
        isValidConnection,
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
        setZoom,
    };
    globalValue = useMemo(() => globalValue, Object.values(globalValue));

    return (
        <GlobalVolatileContext.Provider value={globalChainValue}>
            <GlobalContext.Provider value={globalValue}>{children}</GlobalContext.Provider>
        </GlobalVolatileContext.Provider>
    );
};
