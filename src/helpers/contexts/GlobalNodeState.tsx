import log from 'electron-log';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    Connection,
    Edge,
    getOutgoers,
    Node,
    OnEdgesChange,
    OnNodesChange,
    ReactFlowInstance,
    useEdgesState,
    useKeyPress,
    useNodesState,
    useReactFlow,
    Viewport,
    XYPosition,
} from 'react-flow-renderer';
import { v4 as uuidv4 } from 'uuid';
import {
    EdgeData,
    InputData,
    InputValue,
    IteratorSize,
    Mutable,
    NodeData,
    Size,
} from '../../common-types';
import { useAsyncEffect } from '../hooks/useAsyncEffect';
import useSessionStorage from '../hooks/useSessionStorage';
import { snapToGrid } from '../reactFlowUtil';
import { ipcRenderer } from '../safeIpc';
import { SaveData } from '../SaveFile';
import { SchemaMap } from '../SchemaMap';
import { copyNode, deepCopy, parseHandle } from '../util';
import { SettingsContext } from './SettingsContext';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

interface Global {
    schemata: SchemaMap;
    nodes: readonly Node<NodeData>[];
    edges: readonly Edge<EdgeData>[];
    setNodes: SetState<Node<NodeData>[]>;
    setEdges: SetState<Edge<EdgeData>[]>;
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
    createNode: (proto: NodeProto) => Node<NodeData>;
    createConnection: (connection: Connection) => void;
    reactFlowInstance: ReactFlowInstance<NodeData, EdgeData> | null;
    setReactFlowInstance: SetState<ReactFlowInstance<NodeData, EdgeData> | null>;
    reactFlowWrapper: React.RefObject<Element>;
    isValidConnection: (connection: Readonly<Connection>) => boolean;
    useInputData: <T extends NonNullable<InputValue>>(
        id: string,
        index: number
    ) => readonly [T | undefined, (data: T) => void];
    useAnimateEdges: () => readonly [
        (nodeIdsToAnimate?: readonly string[] | undefined) => void,
        (nodeIdsToUnAnimate?: readonly string[] | undefined) => void,
        (finished: readonly string[]) => void,
        () => void
    ];
    removeNodeById: (id: string) => void;
    removeEdgeById: (id: string) => void;
    useNodeLock: (
        id: string,
        index?: number | null
    ) =>
        | readonly []
        | readonly [isLocked: boolean, toggleLocked: () => void, isInputLocked: boolean];
    duplicateNode: (id: string) => void;
    clearNode: (id: string) => void;
    outlineInvalidNodes: (invalidNodes: readonly Node<NodeData>[]) => void;
    zoom: number;
    onMoveEnd: (event: unknown, viewport: Viewport) => void;
    useIteratorSize: (
        id: string
    ) => readonly [setSize: (size: IteratorSize) => void, defaultSize: Size];
    updateIteratorBounds: (id: string, iteratorSize: IteratorSize, dimensions?: Size) => void;
    setIteratorPercent: (id: string, percent: number) => void;
    closeAllMenus: () => void;
    useHoveredNode: readonly [string | null | undefined, SetState<string | null | undefined>];
    useMenuCloseFunctions: readonly [
        closeAllMenus: () => void,
        addMenuCloseFunction: (func: () => void, id: string) => void
    ];
}

interface NodeProto {
    position: XYPosition;
    data: Omit<NodeData, 'id' | 'inputData'> & { inputData?: InputData };
    nodeType: string;
    parent?: string | Node<NodeData> | null;
}

// TODO: Find default
export const GlobalContext = createContext<Readonly<Global>>({} as Global);

const createUniqueId = () => uuidv4();

interface GlobalProviderProps {
    schemata: SchemaMap;
    reactFlowWrapper: React.RefObject<Element>;
}

export const GlobalProvider = ({
    children,
    schemata,
    reactFlowWrapper,
}: React.PropsWithChildren<GlobalProviderProps>) => {
    const { useSnapToGrid } = useContext(SettingsContext);

    const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<EdgeData>([]);
    const { setViewport, getViewport } = useReactFlow();

    // Cache node state to avoid clearing state when refreshing
    const [cachedNodes, setCachedNodes] = useSessionStorage<Node<NodeData>[]>('cachedNodes', []);
    const [cachedEdges, setCachedEdges] = useSessionStorage<Edge<EdgeData>[]>('cachedEdges', []);
    const [cachedViewport, setCachedViewport] = useSessionStorage<Viewport | null>(
        'cachedViewport',
        null
    );
    useEffect(() => {
        setCachedNodes(nodes);
        setCachedEdges(edges);
        setCachedViewport(getViewport());
    }, [nodes, edges]);
    useEffect(() => {
        if (cachedViewport) setViewport(cachedViewport);
        setNodes(cachedNodes);
        setEdges(cachedEdges);
    }, []);

    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance<
        NodeData,
        EdgeData
    > | null>(null);
    // const [reactFlowInstanceRfi, setRfi] = useState(null);
    const [savePath, setSavePath] = useState<string | undefined>();

    const [loadedFromCli] = useSessionStorage('loaded-from-cli', false);

    const [menuCloseFunctions, setMenuCloseFunctions] = useState<Record<string, () => void>>({});

    const [hoveredNode, setHoveredNode] = useState<string | null | undefined>(null);

    const [, , snapToGridAmount] = useSnapToGrid;

    const dumpState = useCallback((): SaveData => {
        return {
            nodes: deepCopy(nodes),
            edges: deepCopy(edges),
            viewport: getViewport(),
        };
    }, [nodes, edges]);

    const setStateFromJSON = async (savedData: SaveData, loadPosition = false) => {
        const validNodes = savedData.nodes.filter((node) => schemata.has(node.data.identifier));
        if (savedData.nodes.length !== validNodes.length) {
            await ipcRenderer.invoke(
                'show-warning-message-box',
                'File contains invalid nodes',
                'The file you are trying to open contains nodes that are unavailable on your system. Check the dependency manager to see if you are missing any dependencies. The file will now be loaded without the incompatible nodes.'
            );
        }
        setNodes(validNodes);
        setEdges(
            savedData.edges
                // Filter out any edges that do not have a source or target node associated with it
                .filter(
                    (edge) =>
                        validNodes.some((el) => el.id === edge.target) &&
                        validNodes.some((el) => el.id === edge.source)
                )
                // Un-animate all edges, if was accidentally saved when animated
                .map((edge) => ({
                    ...edge,
                    animated: false,
                }))
        );
        if (loadPosition) {
            setViewport(savedData.viewport);
        }
    };

    const clearState = useCallback(() => {
        setEdges([]);
        setNodes([]);
        setSavePath(undefined);
        setViewport({ x: 0, y: 0, zoom: 0 });
    }, [setEdges, setNodes, setSavePath, setViewport]);

    const performSave = useCallback(() => {
        (async () => {
            const saveData = dumpState();
            if (savePath) {
                await ipcRenderer.invoke('file-save-json', saveData, savePath);
            } else {
                const savedAsPath = await ipcRenderer.invoke(
                    'file-save-as-json',
                    saveData,
                    savePath
                );
                setSavePath(savedAsPath);
            }
        })();
    }, [dumpState, savePath]);

    const savePressed = useKeyPress(['Meta+s', 'Control+s']);
    const newPressed = useKeyPress(['Meta+n', 'Control+n']);

    useEffect(() => {
        if (savePressed) {
            performSave();
        }
    }, [savePressed]);

    useEffect(() => {
        if (newPressed) {
            clearState();
        }
    }, [newPressed]);

    // Register New File event handler
    useEffect(() => {
        ipcRenderer.on('file-new', () => {
            clearState();
        });
        return () => {
            ipcRenderer.removeAllListeners('file-new');
        };
    }, []);

    useAsyncEffect(async () => {
        if (!loadedFromCli) {
            const saveData = await ipcRenderer.invoke('get-cli-open');
            if (saveData) {
                await setStateFromJSON(saveData, true);
            }
        }
    }, []);

    // Register Open File event handler
    useEffect(() => {
        ipcRenderer.on('file-open', (event, saveData, openedFilePath) => {
            setSavePath(openedFilePath);
            // TODO: handle promise
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            setStateFromJSON(saveData, true);
        });

        return () => {
            ipcRenderer.removeAllListeners('file-open');
        };
    }, [savePath]);

    // Register Save/Save-As event handlers
    useEffect(() => {
        ipcRenderer.on('file-save-as', () => {
            (async () => {
                const saveData = dumpState();
                const savedAsPath = await ipcRenderer.invoke(
                    'file-save-as-json',
                    saveData,
                    savePath
                );
                setSavePath(savedAsPath);
            })();
        });

        ipcRenderer.on('file-save', () => {
            performSave();
        });

        return () => {
            ipcRenderer.removeAllListeners('file-save-as');
            ipcRenderer.removeAllListeners('file-save');
        };
    }, [dumpState, savePath]);

    // Push state to undo history
    // useEffect(() => {
    //   push(dumpState());
    // }, [nodeData, nodeLocks, reactFlowInstanceRfi, nodes, edges]);

    const removeNodeById = useCallback(
        (id: string) => {
            const node = nodes.find((n) => n.id === id);
            if (node && node.type !== 'iteratorHelper') {
                const newNodes = nodes.filter((n) => n.id !== id && n.parentNode !== id);
                setNodes(newNodes);
            }
        },
        [nodes, setNodes]
    );

    const removeEdgeById = useCallback(
        (id: string) => {
            // eslint-disable-next-line @typescript-eslint/no-shadow
            setEdges((edges) => edges.filter((e) => e.id !== id));
        },
        [setEdges]
    );

    const createNode = useCallback(
        ({ position, data, nodeType, parent = null }: NodeProto): Node<NodeData> => {
            const id = createUniqueId();
            const newNode: Node<Mutable<NodeData>> = {
                type: nodeType,
                id,
                position: snapToGrid(position, snapToGridAmount),
                data: {
                    ...data,
                    id,
                    inputData: data.inputData ?? schemata.getDefaultInput(data.identifier),
                },
            };
            if (parent || (hoveredNode && nodeType !== 'iterator')) {
                let parentNode: Node<NodeData> | null | undefined;
                if (typeof parent === 'string' || parent instanceof String) {
                    parentNode = nodes.find((n) => n.id === parent);
                    // eslint-disable-next-line no-param-reassign
                    parent = null; // This is so it actually set the nodes
                } else if (parent) {
                    parentNode = parent;
                } else {
                    parentNode = nodes.find((n) => n.id === hoveredNode);
                }
                if (parentNode && parentNode.type === 'iterator' && newNode.type !== 'iterator') {
                    const { width, height, offsetTop, offsetLeft } = parentNode.data
                        .iteratorSize ?? {
                        width: 480,
                        height: 480,
                        offsetTop: 0,
                        offsetLeft: 0,
                    };
                    const parentId = (parentNode.id || hoveredNode) ?? undefined;
                    newNode.position.x = position.x - parentNode.position.x;
                    newNode.position.y = position.y - parentNode.position.y;
                    newNode.parentNode = parentId;
                    newNode.data.parentNode = parentId;
                    newNode.extent = [
                        [offsetLeft, offsetTop],
                        [width, height],
                    ];
                }
            }
            const extraNodes: Node<NodeData>[] = [];
            if (nodeType === 'iterator') {
                newNode.data.iteratorSize = {
                    width: 480,
                    height: 480,
                    offsetTop: 0,
                    offsetLeft: 0,
                };

                const { defaultNodes = [] } = schemata.get(data.identifier);

                defaultNodes.forEach(({ identifier }) => {
                    const subNodeData = schemata.get(identifier);
                    const subNode = createNode({
                        nodeType: subNodeData.nodeType,
                        position: newNode.position,
                        data: {
                            category: subNodeData.category,
                            type: subNodeData.name,
                            identifier,
                            subcategory: subNodeData.subcategory,
                            icon: subNodeData.icon,
                        },
                        parent: newNode,
                    });
                    extraNodes.push(subNode);
                });
            }
            if (!parent) {
                setNodes([...nodes, newNode, ...extraNodes]);
            }
            return newNode;
        },
        [nodes, setNodes, schemata, hoveredNode]
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
            // eslint-disable-next-line @typescript-eslint/no-shadow
            setEdges((edges) => [
                ...edges.filter((edge) => edge.targetHandle !== targetHandle),
                newEdge,
            ]);
        },
        [setEdges]
    );

    useEffect(() => {
        const json = sessionStorage.getItem('rfi');
        if (!json) return;
        const flow = JSON.parse(json) as {
            viewport?: Viewport;
            nodes?: Node<NodeData>[];
            edges?: Edge<EdgeData>[];
        };
        const { x = 0, y = 0, zoom = 2 } = flow.viewport ?? {};
        setNodes(flow.nodes || []);
        setEdges(flow.edges || []);
        setViewport({ x, y, zoom });
    }, []);

    const isValidConnection = useCallback(
        ({ target, targetHandle, source, sourceHandle }: Readonly<Connection>) => {
            if (source === target || !sourceHandle || !targetHandle) {
                return false;
            }
            const sourceHandleIndex = parseHandle(sourceHandle).index;
            const targetHandleIndex = parseHandle(targetHandle).index;

            const sourceNode = nodes.find((node) => node.id === source);
            const targetNode = nodes.find((node) => node.id === target);
            if (!sourceNode || !targetNode) {
                return false;
            }

            // Target inputs, source outputs
            const { outputs } = schemata.get(sourceNode.data.identifier);
            const { inputs } = schemata.get(targetNode.data.identifier);

            const sourceOutput = outputs[sourceHandleIndex];
            const targetInput = inputs[targetHandleIndex];

            const checkTargetChildren = (parentNode: Node<NodeData>): boolean => {
                const targetChildren = getOutgoers(parentNode, nodes, edges);
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
        [nodes, edges, schemata]
    );

    const useInputData = useCallback(
        // eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions, func-names
        function <T extends NonNullable<InputValue>>(
            id: string,
            index: number
        ): readonly [T | undefined, (data: T) => void] {
            const nodeById = nodes.find((node) => node.id === id);
            const nodeData = nodeById?.data;

            if (!nodeData) {
                return [undefined, () => {}] as const;
            }

            const { inputData } = nodeData;
            const inputDataByIndex = inputData[index] as T | undefined;
            const setInputData = (data: T) => {
                // This is a action that might be called asynchronously, so we cannot rely on of
                // the captured data from `nodes` to be up-to-date anymore. For that reason, we
                // must derive any changes to nodes from the previous value passed to us by
                // `setNodes`.

                // eslint-disable-next-line @typescript-eslint/no-shadow
                setNodes((nodes) => {
                    // eslint-disable-next-line @typescript-eslint/no-shadow
                    const nodeById = nodes.find((node) => node.id === id);
                    if (!nodeById) {
                        log.error(
                            'A (deferred) setInputData was called after its node had been removed'
                        );
                        return nodes;
                    }

                    const nodeCopy: Node<Mutable<NodeData>> = copyNode(nodeById);
                    if (nodeCopy && nodeCopy.data) {
                        nodeCopy.data.inputData = {
                            ...inputData,
                            [index]: data,
                        };
                    }
                    const filteredNodes = nodes.filter((n) => n.id !== id);
                    return [...filteredNodes, nodeCopy];
                });
            };
            return [inputDataByIndex, setInputData] as const;
        },
        [nodes, setNodes, schemata]
    );

    const useAnimateEdges = useCallback(() => {
        const setAnimated = (animated: boolean, nodeIdsToAnimate?: readonly string[]) => {
            // eslint-disable-next-line @typescript-eslint/no-shadow
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
            // eslint-disable-next-line @typescript-eslint/no-shadow
            setEdges((edges) =>
                edges.map((edge): Edge<EdgeData> => {
                    const complete = finished.includes(edge.source);
                    return {
                        ...edge,
                        animated: !complete,
                        data: {
                            ...edge.data,
                            complete,
                        },
                    };
                })
            );
        };

        const clearCompleteEdges = () => {
            // eslint-disable-next-line @typescript-eslint/no-shadow
            setEdges((edges) =>
                edges.map((edge): Edge<EdgeData> => {
                    return {
                        ...edge,
                        animated: false,
                        data: {
                            ...edge.data,
                            complete: false,
                        },
                    };
                })
            );
        };

        return [animateEdges, unAnimateEdges, completeEdges, clearCompleteEdges] as const;
    }, [setEdges]);

    // TODO: performance concern? runs twice when deleting node
    const useNodeLock = useCallback(
        (id: string, index?: number | null) => {
            const node = nodes.find((n) => n.id === id);
            if (!node) {
                return [] as const;
            }
            const isLocked = node.data.isLocked ?? false;
            const toggleLock = () => {
                const newNode = copyNode(node);
                newNode.draggable = isLocked;
                newNode.connectable = isLocked;
                newNode.data.isLocked = !isLocked;
                setNodes([...nodes.filter((n) => n.id !== id), newNode]);
            };

            let isInputLocked = false;
            if (index !== undefined && index !== null) {
                const edge = edges.find(
                    (e) =>
                        e.target === id &&
                        !!e.targetHandle &&
                        parseHandle(e.targetHandle).index === index
                );
                isInputLocked = !!edge;
            }
            return [isLocked, toggleLock, isInputLocked] as const;
        },
        [nodes, edges, setNodes]
    );

    const useIteratorSize = useCallback(
        (id: string) => {
            const defaultSize: Size = { width: 480, height: 480 };
            // TODO: What happens when the node wasn't found?
            const node = nodes.find((n) => n.id === id)!;

            const setIteratorSize = (size: IteratorSize) => {
                const newNode = copyNode(node);
                newNode.data.iteratorSize = size;
                setNodes([...nodes.filter((n) => n.id !== id), newNode]);
            };

            return [setIteratorSize, defaultSize] as const;
        },
        [nodes, setNodes]
    );

    // TODO: this can probably be cleaned up but its good enough for now
    const updateIteratorBounds = useCallback(
        (id: string, iteratorSize: IteratorSize, dimensions?: Size) => {
            const nodesToUpdate = nodes.filter((n) => n.parentNode === id);
            const iteratorNode = nodes.find((n) => n.id === id);
            if (iteratorNode && nodesToUpdate.length > 0) {
                const { width, height, offsetTop, offsetLeft } = iteratorSize;
                let maxWidth = 256;
                let maxHeight = 256;
                nodesToUpdate.forEach((n) => {
                    maxWidth = Math.max(n.width ?? dimensions?.width ?? maxWidth, maxWidth);
                    maxHeight = Math.max(n.height ?? dimensions?.height ?? maxHeight, maxHeight);
                });
                const newNodes = nodesToUpdate.map((n) => {
                    const newNode: Node<NodeData> = { ...n };
                    const wBound = width - (n.width ?? dimensions?.width ?? 0) + offsetLeft;
                    const hBound = height - (n.height ?? dimensions?.height ?? 0) + offsetTop;
                    newNode.extent = [
                        [offsetLeft, offsetTop],
                        [wBound, hBound],
                    ];
                    newNode.position.x = Math.min(Math.max(newNode.position.x, offsetLeft), wBound);
                    newNode.position.y = Math.min(Math.max(newNode.position.y, offsetTop), hBound);
                    return newNode;
                });
                const newIteratorNode = copyNode(iteratorNode);

                newIteratorNode.data.maxWidth = maxWidth;
                newIteratorNode.data.maxHeight = maxHeight;
                // TODO: prove that those non-null assertions are valid or make them unnecessary
                newIteratorNode.data.iteratorSize!.width = width < maxWidth ? maxWidth : width;
                newIteratorNode.data.iteratorSize!.height = height < maxHeight ? maxHeight : height;
                setNodes([
                    newIteratorNode,
                    ...nodes.filter((n) => n.parentNode !== id && n.id !== id),
                    ...newNodes,
                ]);
            }
        },
        [nodes, setNodes]
    );

    const setIteratorPercent = useCallback(
        (id: string, percent: number) => {
            const iterator = nodes.find((n) => n.id === id);
            if (iterator) {
                const newIterator = copyNode(iterator);
                newIterator.data.percentComplete = percent;
                const filteredNodes = nodes.filter((n) => n.id !== id);
                setNodes([newIterator, ...filteredNodes]);
            }
        },
        [nodes, setNodes]
    );

    const duplicateNode = useCallback(
        (id: string) => {
            const node = nodes.find((n) => n.id === id);
            if (!node) return;
            const newId = createUniqueId();
            const newNode = {
                ...node,
                id: newId,
                position: {
                    x: (node.position.x || 0) + 200,
                    y: (node.position.y || 0) + 200,
                },
                data: {
                    ...node.data,
                    id: newId,
                },
                selected: false,
            };
            const newNodes: Node<NodeData>[] = [newNode];
            const newEdges: Edge<EdgeData>[] = [];
            if (node.type === 'iterator') {
                const oldToNewIdMap: Record<string, string> = {};
                const childNodes = nodes.filter((n) => n.parentNode === id);
                childNodes.forEach((c) => {
                    const newChildId = createUniqueId();
                    oldToNewIdMap[c.id] = newChildId;
                    const newChild = {
                        ...c,
                        id: newChildId,
                        position: { ...c.position },
                        data: {
                            ...c.data,
                            id: newChildId,
                            parentNode: newId,
                        },
                        parentNode: newId,
                        selected: false,
                    };
                    newNodes.push(newChild);
                });
                const oldChildIds = Object.keys(oldToNewIdMap);
                const childEdges = edges.filter((e) => oldChildIds.includes(e.target));
                childEdges.forEach((e) => {
                    const { source, sourceHandle, target, targetHandle } = e;
                    if (!sourceHandle || !targetHandle) return;
                    const newEdgeId = createUniqueId();
                    const newSource = oldToNewIdMap[source];
                    const newTarget = oldToNewIdMap[target];
                    const newSourceHandle = sourceHandle.replace(source, newSource);
                    const newTargetHandle = targetHandle.replace(target, newTarget);
                    const newEdge: Edge<EdgeData> = {
                        ...e,
                        id: newEdgeId,
                        source: newSource,
                        sourceHandle: newSourceHandle,
                        target: newTarget,
                        targetHandle: newTargetHandle,
                    };
                    newEdges.push(newEdge);
                });
            }
            setNodes([...nodes, ...newNodes]);
            setEdges([...edges, ...newEdges]);
        },
        [nodes, edges]
    );

    const clearNode = (id: string) => {
        const nodesCopy = [...nodes];
        const node = nodesCopy.find((n) => n.id === id);
        if (!node) return;
        const newNode = copyNode(node);
        newNode.data.inputData = schemata.getDefaultInput(node.data.identifier);
        setNodes([...nodes.filter((n) => n.id !== id), newNode]);
    };

    const outlineInvalidNodes = (invalidNodes: readonly Node<NodeData>[]) => {
        const invalidIds = invalidNodes.map((node) => node.id);
        const mappedNodes = invalidNodes.map((node) => {
            const nodeCopy = copyNode(node);
            nodeCopy.data.invalid = true;
            return nodeCopy;
        });
        setNodes([...nodes.filter((node) => !invalidIds.includes(node.id)), ...mappedNodes]);
    };

    const unOutlineInvalidNodes = (invalidNodes: readonly Node<NodeData>[]) => {
        const invalidIds = invalidNodes.map((node) => node.id);
        const mappedNodes = invalidNodes.map((node) => {
            const nodeCopy = copyNode(node);
            nodeCopy.data.invalid = false;
            return nodeCopy;
        });
        setNodes([...nodes.filter((node) => !invalidIds.includes(node.id)), ...mappedNodes]);
    };

    const [zoom, setZoom] = useState(1);
    const onMoveEnd = (event: unknown, viewport: Viewport) => {
        setZoom(viewport.zoom);
    };

    const addMenuCloseFunction = useCallback(
        (func: () => void, id: string) => {
            const menuFuncs = { ...menuCloseFunctions };
            menuFuncs[id] = func;
            setMenuCloseFunctions(menuFuncs);
        },
        [menuCloseFunctions, setMenuCloseFunctions]
    );

    const closeAllMenus = useCallback(() => {
        Object.keys(menuCloseFunctions).forEach((id) => {
            menuCloseFunctions[id]();
        });
    }, [menuCloseFunctions]);

    const contextValue = useMemo<Global>(
        () => ({
            schemata,
            nodes,
            edges,
            setNodes,
            setEdges,
            onNodesChange,
            onEdgesChange,
            createNode,
            createConnection,
            reactFlowInstance,
            setReactFlowInstance,
            // updateRfi,
            reactFlowWrapper,
            isValidConnection,
            useInputData,
            useAnimateEdges,
            removeNodeById,
            removeEdgeById,
            useNodeLock,
            duplicateNode,
            clearNode,
            // setSelectedElements,
            outlineInvalidNodes,
            unOutlineInvalidNodes,
            zoom,
            onMoveEnd,
            useIteratorSize,
            updateIteratorBounds,
            setIteratorPercent,
            closeAllMenus,
            useHoveredNode: [hoveredNode, setHoveredNode] as const,
            useMenuCloseFunctions: [closeAllMenus, addMenuCloseFunction] as const,
        }),
        [nodes, edges, reactFlowInstance, zoom, hoveredNode, menuCloseFunctions]
    );

    return <GlobalContext.Provider value={contextValue}>{children}</GlobalContext.Provider>;
};
