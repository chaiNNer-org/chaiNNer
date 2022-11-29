/* eslint-disable @typescript-eslint/no-shadow */
import { Box } from '@chakra-ui/react';
import { Bezier } from 'bezier-js';
import log from 'electron-log';
import { DragEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaFileExport } from 'react-icons/fa';
import ReactFlow, {
    Background,
    BackgroundVariant,
    ControlButton,
    Controls,
    CoordinateExtent,
    Edge,
    EdgeTypes,
    Node,
    NodeTypes,
    OnEdgesChange,
    OnNodesChange,
    Position,
    Viewport,
    XYPosition,
    useEdgesState,
    useKeyPress,
    useNodesState,
    useReactFlow,
} from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { EdgeData, NodeData } from '../../common/common-types';
import {
    EMPTY_ARRAY,
    parseSourceHandle,
    stringifySourceHandle,
    stringifyTargetHandle,
} from '../../common/util';
import { AlertBoxContext, AlertType } from '../contexts/AlertBoxContext';
import { BackendContext } from '../contexts/BackendContext';
import { ContextMenuContext } from '../contexts/ContextMenuContext';
import { GlobalContext, GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { SettingsContext } from '../contexts/SettingsContext';
import { getFirstPossibleInput, getFirstPossibleOutput } from '../helpers/connectedInputs';
import { DataTransferProcessorOptions, dataTransferProcessors } from '../helpers/dataTransfer';
import { AABB, Point, getBezierPathValues, pointDist } from '../helpers/graphUtils';
import { expandSelection, isSnappedToGrid, snapToGrid } from '../helpers/reactFlowUtil';
import { useMemoArray } from '../hooks/useMemo';
import { useNodesMenu } from '../hooks/useNodesMenu';
import { usePaneNodeSearchMenu } from '../hooks/usePaneNodeSearchMenu';

const compareById = (a: Edge | Node, b: Edge | Node) => a.id.localeCompare(b.id);

const STARTING_Z_INDEX = 50;
/**
 * We want the nodes and edges to form the following layers:
 *
 * - Iterator node 1
 * - Nodes inside iterator 1
 * - Iterator node 2
 * - Nodes inside iterator 2
 * - ...
 * - Related iterator node 1
 * - Related nodes inside iterator 1
 * - Related iterator node 2
 * - Related nodes inside iterator 2
 * - ...
 * - Free nodes
 * - Selected nodes
 *   - Same relative order as not-selected nodes
 *
 * Note that child nodes of selected iterator nodes are implicitly selected as well.
 *
 * Related iterator nodes are the parent nodes of a currently selected child node.
 * Related nodes inside iterators are the sibling nodes of a currently selected child node.
 *
 * The zIndex of an edge will be `max(source, target) - 1`. Note that `-1` doesn't mean
 * "the layer below", but "in between this layer and the below layer".
 * The only exception is when the edge is selected but neither its not its target are selected.
 * In this case, the edge will to be in the highest selected layer.
 */
const updateZIndexes = (
    nodes: readonly Node<NodeData>[],
    edges: readonly Edge<EdgeData>[]
): void => {
    const selectedIterators = new Set<string>();
    const relatedIterators = new Set<string>();
    /** Maps each iterator id to the relative position of the iterator in the node array */
    const iteratorIndexMap = new Map<string, number>();
    const byId = new Map<string, Node<NodeData>>();

    // go through all nodes to collect some information
    for (const n of nodes) {
        byId.set(n.id, n);

        if (n.type === 'iterator') {
            iteratorIndexMap.set(n.id, iteratorIndexMap.size);
            if (n.selected) {
                selectedIterators.add(n.id);
                relatedIterators.delete(n.id);
            }
        } else if (n.parentNode) {
            if (n.selected && !selectedIterators.has(n.parentNode)) {
                relatedIterators.add(n.parentNode);
            }
        }
    }

    const getIteratorZIndex = (id: string): number => {
        const iterIndex = iteratorIndexMap.get(id) ?? 0;
        return STARTING_Z_INDEX + iterIndex * 4;
    };

    const iteratorsRange = iteratorIndexMap.size * 4;

    const FREE_NODES_INDEX = STARTING_Z_INDEX + iteratorsRange * 2;
    const RELATED_ADD = iteratorsRange;
    const SELECTED_ADD = iteratorsRange * 2 + 20;
    const MIN_SELECTED_INDEX = STARTING_Z_INDEX + SELECTED_ADD;

    // set the zIndex of all nodes
    for (const n of nodes) {
        if (n.type === 'iterator') {
            // Iterator

            let zIndex = getIteratorZIndex(n.id);
            if (n.selected) {
                zIndex += SELECTED_ADD;
            } else if (relatedIterators.has(n.id)) {
                zIndex += RELATED_ADD;
            }
            n.zIndex = zIndex;
        } else if (n.parentNode) {
            // Iterator child node

            let zIndex = getIteratorZIndex(n.parentNode) + 2;
            if (n.selected || selectedIterators.has(n.parentNode)) {
                zIndex += SELECTED_ADD;
            } else if (relatedIterators.has(n.parentNode)) {
                zIndex += RELATED_ADD;
            }
            n.zIndex = zIndex;
        } else {
            // Free node

            let zIndex = FREE_NODES_INDEX;
            if (n.selected) {
                zIndex += SELECTED_ADD;
            }
            n.zIndex = zIndex;
        }
    }

    const nodesToAdjust: { node: Node<NodeData>; zIndex: number }[] = [];
    // set the zIndex of all edges
    for (const e of edges) {
        let zIndex = Math.max(
            byId.get(e.source)?.zIndex ?? STARTING_Z_INDEX,
            byId.get(e.target)?.zIndex ?? STARTING_Z_INDEX
        );

        const connectedNodes = nodes.filter((n) => n.id === e.source || n.id === e.target);

        if (e.selected && zIndex < MIN_SELECTED_INDEX) {
            zIndex += SELECTED_ADD;
            // If an edge is selected, make the connected nodes the same zIndex
            connectedNodes.forEach((n) => {
                if (n.type !== 'iterator') {
                    // We need to wait until after the loop to adjust the zIndex
                    nodesToAdjust.push({ node: n, zIndex });
                }
            });
        } else if (connectedNodes.some((n) => n.selected)) {
            // If an edge is connectec to a selected node, we need to make the other node it is connected to the same zIndex
            connectedNodes.forEach((n) => {
                if (!n.selected && n.type !== 'iterator') {
                    // We need to wait until after the loop to adjust the zIndex
                    nodesToAdjust.push({ node: n, zIndex });
                }
            });
        }

        e.zIndex = zIndex - 1;
    }

    // Adjust the zIndex of the nodes that were connected to selected edges
    for (const { node, zIndex } of nodesToAdjust) {
        node.zIndex = zIndex;
    }

    // Now we have to adjust iterators that are connected to any edges, to make sure they are above them
    for (const n of nodes) {
        if (n.type === 'iterator') {
            const connectedEdges = edges.filter((e) => e.source === n.id || e.target === n.id);
            if (connectedEdges.length > 0) {
                const zIndexToUpdateTo =
                    Math.max(n.zIndex || 0, ...connectedEdges.map((e) => e.zIndex || 0)) + 1;
                // We also have to do to all children nodes and edges...
                const iConnectedNodes = nodes.filter((node) => node.parentNode === n.id);
                const iConnectedNodeIds = iConnectedNodes.map((node) => node.id);
                const iConnectedEdges = edges.filter(
                    (e) =>
                        iConnectedNodeIds.includes(e.source) || iConnectedNodeIds.includes(e.target)
                );
                for (const node of iConnectedNodes) {
                    const offset = (node.zIndex || 0) - (n.zIndex || 0);
                    node.zIndex = zIndexToUpdateTo + offset;
                }
                for (const edge of iConnectedEdges) {
                    const offset = (edge.zIndex || 0) - (n.zIndex || 0);
                    edge.zIndex = zIndexToUpdateTo + offset;
                }
                n.zIndex = zIndexToUpdateTo;
            }
        }
    }
};

interface ReactFlowBoxProps {
    nodeTypes: NodeTypes;
    edgeTypes: EdgeTypes;
    wrapperRef: React.RefObject<HTMLDivElement>;
}
export const ReactFlowBox = memo(({ wrapperRef, nodeTypes, edgeTypes }: ReactFlowBoxProps) => {
    const { sendAlert } = useContext(AlertBoxContext);
    const { closeContextMenu } = useContext(ContextMenuContext);
    const {
        setZoom,
        setHoveredNode,
        setCollidingEdge,
        setCollidingNode,
        addNodeChanges,
        addEdgeChanges,
        changeNodes,
        changeEdges,
        createNode,
        createConnection,
        setNodesRef,
        setEdgesRef,
        removeEdgeById,
        exportViewportScreenshot,
    } = useContext(GlobalContext);
    const { schemata, functionDefinitions } = useContext(BackendContext);

    const useSnapToGrid = useContextSelector(SettingsContext, (c) => c.useSnapToGrid);
    const animateChain = useContextSelector(SettingsContext, (c) => c.useAnimateChain[0]);
    const [isSnapToGrid, , snapToGridAmount] = useSnapToGrid;

    const typeState = useContextSelector(GlobalVolatileContext, (c) => c.typeState);

    const reactFlowInstance = useReactFlow();

    const [nodes, setNodes, internalOnNodesChange] = useNodesState<NodeData>([]);
    const [edges, setEdges, internalOnEdgesChange] = useEdgesState<EdgeData>([]);
    setNodesRef.current = setNodes;
    setEdgesRef.current = setEdges;

    const altPressed = useKeyPress(['Alt', 'Option']);

    const onNodesChange: OnNodesChange = useCallback(
        (changes) => {
            // we handle removes ourselves
            internalOnNodesChange(changes.filter((c) => c.type !== 'remove'));
        },
        [internalOnNodesChange]
    );
    const onEdgesChange: OnEdgesChange = useCallback(
        (changes) => {
            // we handle removes ourselves
            internalOnEdgesChange(changes.filter((c) => c.type !== 'remove'));
        },
        [internalOnEdgesChange]
    );

    const [displayNodes, displayEdges] = useMemo(() => {
        const displayNodes = nodes.map<Node<NodeData>>((n) => ({ ...n })).sort(compareById);
        const displayEdges = edges.map<Edge<EdgeData>>((e) => ({ ...e })).sort(compareById);

        updateZIndexes(displayNodes, displayEdges);

        if (isSnapToGrid) {
            for (const n of displayNodes) {
                if (!isSnappedToGrid(n.position, snapToGridAmount)) {
                    n.position = snapToGrid(n.position, snapToGridAmount);
                }
            }
        }

        return [displayNodes, displayEdges, isSnapToGrid && snapToGridAmount];
    }, [nodes, edges, isSnapToGrid, snapToGridAmount]);

    // Node-on-edge collision detection
    const performNodeOnEdgeCollisionDetection = useCallback(
        (node: Node<NodeData>, mousePosition: XYPosition, quick = true) => {
            // First, we need to make sure this node is an orphan. We can do a find so it stops early
            const hasConnectedEdge = !!edges.find(
                (e) => e.source === node.id || e.target === node.id
            );
            if (hasConnectedEdge) {
                return;
            }

            const nodeBB = AABB.fromPoints(
                {
                    x: node.position.x || 0,
                    y: node.position.y || 0,
                },
                {
                    x: (node.position.x || 0) + (node.width || 0),
                    y: (node.position.y || 0) + (node.height || 0),
                }
            );

            const fn = functionDefinitions.get(node.data.schemaId);
            if (!fn) {
                return;
            }

            // Finds the first edge that intersects with the node
            const intersectingEdges = edges
                .filter((e): e is Edge<EdgeData> & { data: Required<EdgeData> } => {
                    // if one value is set, all are
                    return e.data?.sourceX !== undefined;
                })
                .flatMap((e) => {
                    const sourceP: Point = { x: e.data.sourceX, y: e.data.sourceY };
                    const targetP: Point = { x: e.data.targetX, y: e.data.targetY };

                    // check node and edge bounding boxes
                    const edgeBB = AABB.fromPoints(sourceP, targetP);
                    if (!nodeBB.intersects(edgeBB)) {
                        return EMPTY_ARRAY;
                    }

                    // Check if the node has valid connections it can make
                    // If it doesn't, we don't need to bother checking collision
                    if (!e.sourceHandle || !e.targetHandle) {
                        return EMPTY_ARRAY;
                    }
                    const { outputId } = parseSourceHandle(e.sourceHandle);
                    const edgeType = typeState.functions.get(e.source)?.outputs.get(outputId);
                    if (
                        !edgeType ||
                        getFirstPossibleInput(fn, edgeType) === undefined ||
                        getFirstPossibleOutput(fn, edgeType) === undefined
                    ) {
                        return EMPTY_ARRAY;
                    }

                    const bezierPathCoordinates = getBezierPathValues({
                        sourceX: e.data.sourceX,
                        sourceY: e.data.sourceY,
                        sourcePosition: Position.Right,
                        targetX: e.data.targetX,
                        targetY: e.data.targetY,
                        targetPosition: Position.Left,
                    });

                    // Here we use Bezier-js to determine if any of the node's sides intersect with the curve
                    // TODO: there might be a way to select the order in which to check based on the position of the node relative to the edge
                    // However, I don't want to figure that out right now, and this works well enough.
                    const curve = new Bezier(bezierPathCoordinates);
                    if (!nodeBB.intersectsCurve(curve)) {
                        return EMPTY_ARRAY;
                    }

                    const mouseDist = pointDist(mousePosition, curve.project(mousePosition));
                    return { e, mouseDist } as const;
                })
                // Sort the edges by their distance from the mouse position
                .sort((a, b) => a.mouseDist - b.mouseDist)
                .map(({ e }) => e);

            // Early exit if there is not an intersecting edge
            if (intersectingEdges.length === 0) {
                return;
            }

            const intersectingEdge = intersectingEdges[0];

            // Check if the node has valid connections it can make
            if (!intersectingEdge.sourceHandle) {
                return;
            }
            const edgeType = typeState.functions
                .get(intersectingEdge.source)
                ?.outputs.get(parseSourceHandle(intersectingEdge.sourceHandle).outputId);
            if (!edgeType) {
                return;
            }

            const firstPossibleInput = getFirstPossibleInput(fn, edgeType);
            if (firstPossibleInput === undefined) {
                return;
            }
            const firstPossibleOutput = getFirstPossibleOutput(fn, edgeType);
            if (firstPossibleOutput === undefined) {
                return;
            }

            const fromNode = nodes.find((n) => n.id === intersectingEdge.source);
            const toNode = nodes.find((n) => n.id === intersectingEdge.target);
            if (!(fromNode && toNode)) {
                return;
            }

            // We don't need to bother setting up the combination function if we're just detecting the collision for visualization
            if (quick) {
                return {
                    status: 'success',
                    performCombine: () => {},
                    intersectingEdge,
                };
            }

            return {
                status: 'success',
                performCombine: () => {
                    removeEdgeById(intersectingEdge.id);
                    createConnection({
                        source: fromNode.id,
                        sourceHandle: intersectingEdge.sourceHandle!,
                        target: node.id,
                        targetHandle: stringifyTargetHandle({
                            nodeId: node.id,
                            inputId: firstPossibleInput,
                        }),
                    });
                    createConnection({
                        source: node.id,
                        sourceHandle: stringifySourceHandle({
                            nodeId: node.id,
                            outputId: firstPossibleOutput,
                        }),
                        target: toNode.id,
                        targetHandle: intersectingEdge.targetHandle!,
                    });
                },
                intersectingEdge,
            };
        },
        [createConnection, edges, functionDefinitions, nodes, removeEdgeById, typeState.functions]
    );

    const onNodeDrag = useCallback(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (event: React.MouseEvent, node: Node<NodeData>, _nodes: Node[]) => {
            if (altPressed) {
                const mousePosition = {
                    // React flow's type for the event is incorrect. This value exists.
                    x: node.position.x + (event as unknown as MouseEvent).offsetX,
                    y: node.position.y + (event as unknown as MouseEvent).offsetY,
                };
                const collisionResp = performNodeOnEdgeCollisionDetection(
                    node,
                    mousePosition,
                    true
                );
                if (collisionResp?.status === 'success') {
                    setCollidingEdge(collisionResp.intersectingEdge);
                    setCollidingNode(node);
                } else {
                    setCollidingEdge(undefined);
                    setCollidingNode(undefined);
                }
            }
        },
        [altPressed, performNodeOnEdgeCollisionDetection, setCollidingEdge, setCollidingNode]
    );

    const lastAltPressed = useRef<boolean>(altPressed);
    useEffect(() => {
        if (lastAltPressed.current !== altPressed) {
            lastAltPressed.current = altPressed;
            if (!altPressed) {
                setCollidingEdge(undefined);
                setCollidingNode(undefined);
            }
        }
    }, [altPressed, setCollidingEdge, setCollidingNode]);

    const onNodeDragStop = useCallback(
        (event: React.MouseEvent, node: Node<NodeData> | null, draggedNodes: Node<NodeData>[]) => {
            if (node && altPressed) {
                const mousePosition = {
                    // React flow's type for the event is incorrect. This value exists.
                    x: node.position.x + (event as unknown as MouseEvent).offsetX,
                    y: node.position.y + (event as unknown as MouseEvent).offsetY,
                };
                const collisionResp = performNodeOnEdgeCollisionDetection(
                    node,
                    mousePosition,
                    false
                );
                if (collisionResp?.status === 'success') {
                    collisionResp.performCombine();
                    setCollidingEdge(collisionResp.intersectingEdge);
                    setCollidingNode(node);
                } else {
                    setCollidingEdge(undefined);
                    setCollidingNode(undefined);
                }
            }
            const newNodes: Node<NodeData>[] = [];
            const edgesToRemove: Edge[] = [];
            const allIterators = nodes.filter((n) => n.type === 'iterator');
            const draggedNodeIds = draggedNodes.map((n) => n.id);
            draggedNodes.forEach((node) => {
                if (!node.parentNode && node.type === 'regularNode') {
                    const iterInBounds = allIterators.find(
                        (iterator) =>
                            iterator.position.x + (iterator.data.iteratorSize?.offsetLeft ?? 0) <
                                node.position.x &&
                            iterator.position.y + (iterator.data.iteratorSize?.offsetTop ?? 0) <
                                node.position.y &&
                            iterator.position.x + (iterator.width ?? 0) >
                                node.position.x + (node.width ?? 0) &&
                            iterator.position.y + (iterator.height ?? 0) >
                                node.position.y + (node.height ?? 0)
                    );
                    if (iterInBounds) {
                        const {
                            offsetTop = 0,
                            offsetLeft = 0,
                            width = 0,
                            height = 0,
                        } = iterInBounds.data.iteratorSize ?? {};
                        const wBound = width - (node.width ?? 0) + offsetLeft;
                        const hBound = height - (node.height ?? 0) + offsetTop;
                        const newNode = {
                            ...node,
                            data: { ...node.data, parentNode: iterInBounds.id },
                            parentNode: iterInBounds.id,
                            extent: [
                                [offsetLeft, offsetTop],
                                [wBound, hBound],
                            ] as CoordinateExtent,
                            position: {
                                x: node.position.x - iterInBounds.position.x,
                                y: node.position.y - iterInBounds.position.y,
                            },
                        };

                        edgesToRemove.push(
                            ...edges.filter((e) => {
                                if (e.source === node.id) {
                                    const target = nodes.find((n) => n.id === e.target);
                                    if (target && !draggedNodeIds.includes(target.id)) {
                                        return target.parentNode !== iterInBounds.id;
                                    }
                                }
                                return false;
                            })
                        );

                        newNodes.push(newNode);
                    }
                }
            });
            if (newNodes.length > 0) {
                changeNodes((oldNodes) => [
                    ...oldNodes.filter((n) => !newNodes.map((n) => n.id).includes(n.id)),
                    ...newNodes,
                ]);
                changeEdges((oldEdges) => oldEdges.filter((e) => !edgesToRemove.includes(e)));
            }

            addNodeChanges();
            addEdgeChanges();
        },
        [
            altPressed,
            nodes,
            addNodeChanges,
            addEdgeChanges,
            performNodeOnEdgeCollisionDetection,
            setCollidingEdge,
            setCollidingNode,
            edges,
            changeNodes,
            changeEdges,
        ]
    );

    const onSelectionDragStop = useCallback(
        (event: React.MouseEvent, nNodes: Node<NodeData>[]) => {
            onNodeDragStop(event, null, nNodes);
        },
        [onNodeDragStop]
    );

    const onNodesDelete = useCallback(
        (toDelete: readonly Node<NodeData>[]) => {
            changeNodes((nodes) => {
                const ids = expandSelection(
                    nodes,
                    toDelete.map((n) => n.id)
                );
                return nodes.filter((n) => !ids.has(n.id));
            });
        },
        [changeNodes]
    );

    const onEdgesDelete = useCallback(
        (edgesToDelete: readonly Edge<EdgeData>[]) => {
            const edgeIds = new Set(edgesToDelete.map((e) => e.id));
            changeEdges((edges) => edges.filter((e) => !edgeIds.has(e.id)));
        },
        [changeEdges]
    );

    const onMoveEnd = useCallback(
        (event: unknown, viewport: Viewport) => setZoom(viewport.zoom),
        [setZoom]
    );

    const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        // eslint-disable-next-line no-param-reassign
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDragStart = useCallback(() => {
        setHoveredNode(undefined);
    }, [setHoveredNode]);

    const wrapper = wrapperRef.current;
    const onDrop = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            if (!wrapper) return;

            try {
                const reactFlowBounds = wrapper.getBoundingClientRect();

                const options: DataTransferProcessorOptions = {
                    schemata,
                    createNode,
                    getNodePosition: (offsetX = 0, offsetY = 0) => {
                        const { zoom } = reactFlowInstance.getViewport();
                        return reactFlowInstance.project({
                            x: event.clientX - reactFlowBounds.left - offsetX * zoom,
                            y: event.clientY - reactFlowBounds.top - offsetY * zoom,
                        });
                    },
                    changeNodes,
                    changeEdges,
                };

                for (const processor of dataTransferProcessors) {
                    if (processor(event.dataTransfer, options)) {
                        return;
                    }
                }

                sendAlert({
                    type: AlertType.WARN,
                    message: `Unable to transfer dragged item(s).`,
                });
            } catch (error) {
                log.error(error);
                sendAlert({
                    type: AlertType.ERROR,
                    message: `Failed to drag item.\n\nDetails: ${String(error)}`,
                });
            }
        },
        [createNode, wrapper, reactFlowInstance, schemata, sendAlert, changeEdges, changeNodes]
    );

    // TODO: I want to get this to work at some point but for now it needs to not exist
    // const onEdgeUpdate = useCallback(
    //     (oldEdge: Edge, newConnection: Connection) => {
    //         return setEdges((els) => updateEdge(oldEdge, newConnection, els));
    //     },
    //     [setEdges]
    // );

    const { onConnectStart, onConnectStop, onPaneContextMenu } = usePaneNodeSearchMenu(wrapperRef);

    const [selectedNodes, setSelectedNodes] = useState<Node<NodeData>[]>([]);
    const selectionMenu = useNodesMenu(selectedNodes);
    const onSelectionContextMenu = useCallback(
        (event: React.MouseEvent, nodes: Node<NodeData>[]) => {
            setSelectedNodes(nodes);
            selectionMenu.onContextMenu(event);
        },
        [selectionMenu, setSelectedNodes]
    );

    return (
        <Box
            bg="var(--chain-editor-bg)"
            borderRadius="lg"
            borderWidth="0px"
            className={animateChain ? '' : 'no-chain-animation'}
            h="100%"
            ref={wrapperRef}
            w="100%"
        >
            <ReactFlow
                connectionLineContainerStyle={{ zIndex: 1000 }}
                deleteKeyCode={useMemo(() => ['Backspace', 'Delete'], [])}
                edgeTypes={edgeTypes}
                edges={displayEdges}
                elevateEdgesOnSelect={false}
                maxZoom={8}
                minZoom={0.125}
                multiSelectionKeyCode={useMemo(() => ['Control', 'Meta'], [])}
                nodeTypes={nodeTypes}
                nodes={displayNodes}
                snapGrid={useMemoArray<[number, number]>([snapToGridAmount, snapToGridAmount])}
                snapToGrid={isSnapToGrid}
                style={{
                    zIndex: 0,
                    borderRadius: '0.5rem',
                }}
                onConnect={createConnection}
                onConnectEnd={onConnectStop}
                onConnectStart={onConnectStart}
                onDragOver={onDragOver}
                onDragStart={onDragStart}
                // onEdgeUpdate={onEdgeUpdate}
                onDrop={onDrop}
                onEdgesChange={onEdgesChange}
                onEdgesDelete={onEdgesDelete}
                onMoveEnd={onMoveEnd}
                onMoveStart={closeContextMenu}
                onNodeClick={closeContextMenu}
                onNodeDrag={onNodeDrag}
                onNodeDragStart={closeContextMenu}
                onNodeDragStop={onNodeDragStop}
                onNodesChange={onNodesChange}
                onNodesDelete={onNodesDelete}
                onPaneClick={closeContextMenu}
                onPaneContextMenu={onPaneContextMenu}
                onSelectionContextMenu={onSelectionContextMenu}
                onSelectionDragStop={onSelectionDragStop}
            >
                <Background
                    gap={16}
                    size={1}
                    variant={BackgroundVariant.Dots}
                />
                <Controls>
                    <ControlButton
                        disabled={nodes.length === 0}
                        title="Export viewport as PNG"
                        onClick={exportViewportScreenshot}
                    >
                        <FaFileExport />
                    </ControlButton>
                </Controls>
            </ReactFlow>
        </Box>
    );
});
