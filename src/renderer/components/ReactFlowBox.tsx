/* eslint-disable @typescript-eslint/no-shadow */
import { Box } from '@chakra-ui/react';
import { Bezier } from 'bezier-js';
import log from 'electron-log';
import { DragEvent, memo, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
    Background,
    BackgroundVariant,
    Controls,
    CoordinateExtent,
    Edge,
    EdgeTypes,
    Node,
    NodeTypes,
    OnEdgesChange,
    OnNodesChange,
    Viewport,
    useEdgesState,
    useKeyPress,
    useNodesState,
    useReactFlow,
} from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { EdgeData, NodeData } from '../../common/common-types';
import { stringifySourceHandle, stringifyTargetHandle } from '../../common/util';
import { AlertBoxContext, AlertType } from '../contexts/AlertBoxContext';
import { BackendContext } from '../contexts/BackendContext';
import { ContextMenuContext } from '../contexts/ContextMenuContext';
import { GlobalContext, GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { SettingsContext } from '../contexts/SettingsContext';
import { getFirstPossibleInput, getFirstPossibleOutput } from '../helpers/connectedInputs';
import { DataTransferProcessorOptions, dataTransferProcessors } from '../helpers/dataTransfer';
import { expandSelection, isSnappedToGrid, snapToGrid } from '../helpers/reactFlowUtil';
import { useMemoArray } from '../hooks/useMemo';
import { usePaneNodeSearchMenu } from '../hooks/usePaneNodeSearchMenu';

const compareById = (a: Edge | Node, b: Edge | Node) => a.id.localeCompare(b.id);

// From https://stackoverflow.com/questions/9043805/test-if-two-lines-intersect-javascript-function
// Modified by me
interface Line {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
}
// returns true if the line from (a,b)->(c,d) intersects with (p,q)->(r,s)
const intersects = (a: Line, b: Line) => {
    const det =
        (a.targetX - a.sourceX) * (b.targetY - b.sourceY) -
        (b.targetX - b.sourceX) * (a.targetY - a.sourceY);
    if (det === 0) {
        return false;
    }
    const lambda =
        ((b.targetY - b.sourceY) * (b.targetX - a.sourceX) +
            (b.sourceX - b.targetX) * (b.targetY - a.sourceY)) /
        det;
    const gamma =
        ((a.sourceY - a.targetY) * (b.targetX - a.sourceX) +
            (a.targetX - a.sourceX) * (b.targetY - a.sourceY)) /
        det;
    return lambda > 0 && lambda < 1 && gamma > 0 && gamma < 1;
};

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
                // We need to wait until after the loop to adjust the zIndex
                nodesToAdjust.push({ node: n, zIndex });
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
    const { createNode, createConnection } = useContext(GlobalVolatileContext);
    const {
        setZoom,
        setHoveredNode,
        addNodeChanges,
        addEdgeChanges,
        changeNodes,
        changeEdges,
        setNodesRef,
        setEdgesRef,
        removeEdgeById,
    } = useContext(GlobalContext);
    const { schemata, functionDefinitions } = useContext(BackendContext);

    const useSnapToGrid = useContextSelector(SettingsContext, (c) => c.useSnapToGrid);
    const animateChain = useContextSelector(SettingsContext, (c) => c.useAnimateChain[0]);
    const [isSnapToGrid, , snapToGridAmount] = useSnapToGrid;

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
        (node: Node<NodeData>, quick = true) => {
            // First, we need to make sure this node is an orphan. We can do a find so it stops early
            const hasConnectedEdge = !!edges.find(
                (e) => e.source === node.id || e.target === node.id
            );
            if (hasConnectedEdge) {
                return;
            }

            // Corner positions of node
            const nodeBounds = {
                TL: { x: node.position.x || 0, y: node.position.y || 0 },
                TR: { x: (node.position.x || 0) + (node.width || 0), y: node.position.y || 0 },
                BL: { x: node.position.x || 0, y: (node.position.y || 0) + (node.height || 0) },
                BR: {
                    x: (node.position.x || 0) + (node.width || 0),
                    y: (node.position.y || 0) + (node.height || 0),
                },
            };

            // Finds the first edge that intersects with the node
            const intersectingEdge = edges.find((e) => {
                // Return false if we don't have necessary information
                if (
                    !e.data ||
                    !e.data.sourceX ||
                    !e.data.sourceY ||
                    !e.data.targetX ||
                    !e.data.targetY
                ) {
                    return false;
                }

                // If the node is not within the bounding box of the edge, we can skip it
                const edgeBounds = {
                    minX: Math.min(e.data.sourceX, e.data.targetX) - (node.width || 0),
                    maxX: Math.max(e.data.sourceX, e.data.targetX) + (node.width || 0),
                    minY: Math.min(e.data.sourceY, e.data.targetY) - (node.height || 0),
                    maxY: Math.max(e.data.sourceY, e.data.targetY) + (node.height || 0),
                };
                // Determine if the node is in the bounding box of the edge
                const isNodeInEdgeBounds =
                    edgeBounds.minX <= nodeBounds.TL.x &&
                    edgeBounds.maxX >= nodeBounds.TR.x &&
                    edgeBounds.minY <= nodeBounds.TL.y &&
                    edgeBounds.maxY >= nodeBounds.BL.y;
                if (!isNodeInEdgeBounds) {
                    return false;
                }

                // Determine if the center of the edge is within the node bounds
                // This is a quick check that guarantees collision
                if (
                    e.data.edgeCenterX &&
                    e.data.edgeCenterY &&
                    e.data.edgeCenterX >= nodeBounds.TL.x &&
                    e.data.edgeCenterX <= nodeBounds.TR.x &&
                    e.data.edgeCenterY >= nodeBounds.TL.y &&
                    e.data.edgeCenterY <= nodeBounds.BL.y
                ) {
                    return true;
                }

                const { edgePath } = e.data;
                // If we have the edge path (which we should), we can do a full bezier intersection check
                if (edgePath) {
                    // Here we convert the SVG path into coordinate pairs
                    const [sourcePos, sourceControlVals, targetControlVals, targetPos] =
                        edgePath.split(' ');
                    const [sourceControlX, sourceControlY] = sourceControlVals
                        .replace('C', '')
                        .split(',')
                        .map(Number);
                    const [targetControlX, targetControlY] = targetControlVals
                        .split(',')
                        .map(Number);
                    const [targetX, targetY] = targetPos.split(',').map(Number);
                    const [sourceX, sourceY] = sourcePos.replace('M', '').split(',').map(Number);
                    const coords: number[] = [
                        sourceX,
                        sourceY,
                        sourceControlX,
                        sourceControlY,
                        targetControlX,
                        targetControlY,
                        targetX,
                        targetY,
                    ];

                    // Here we use Bezier-js to determine if any of the node's sides intersect with the curve
                    // TODO: there might be a way to select the order in which to check base don the position of the node relative to the edge
                    // However, I don't want to figure that out right now, and this works well enough.
                    const curve = new Bezier(coords);
                    const curveIntersectsLeft =
                        curve.lineIntersects({
                            p1: nodeBounds.TL,
                            p2: nodeBounds.BL,
                        }).length > 0;
                    if (curveIntersectsLeft) {
                        return true;
                    }
                    const curveIntersectsRight =
                        curve.lineIntersects({
                            p1: nodeBounds.TR,
                            p2: nodeBounds.BR,
                        }).length > 0;
                    if (curveIntersectsRight) {
                        return true;
                    }
                    const curveIntersectsTop =
                        curve.lineIntersects({
                            p1: nodeBounds.TL,
                            p2: nodeBounds.TR,
                        }).length > 0;
                    if (curveIntersectsTop) {
                        return true;
                    }
                    const curveIntersectsBottom =
                        curve.lineIntersects({
                            p1: nodeBounds.BL,
                            p2: nodeBounds.BR,
                        }).length > 0;
                    if (curveIntersectsBottom) {
                        return true;
                    }
                }
                // If we don't have the actual edge path for some reason, we can do a rough check
                // This way approximates collision using a straight line (for the edge) and two diagonal lines (for the node)
                // This probably doesn't need to be here any more, but I figured it would be worth leaving in just in case
                const edgeLine: Line = {
                    sourceX: e.data.sourceX,
                    sourceY: e.data.sourceY,
                    targetX: e.data.targetX,
                    targetY: e.data.targetY,
                };
                // Line from top left to bottom right of node
                const nodeLineTLBR: Line = {
                    sourceX: node.position.x,
                    sourceY: node.position.y,
                    targetX: (node.position.x || 0) + (node.width || 0),
                    targetY: (node.position.y || 0) + (node.height || 0),
                };
                // Line from top right to bottom left of node
                const nodeLineTRBL: Line = {
                    sourceX: (node.position.x || 0) + (node.width || 0),
                    sourceY: node.position.y,
                    targetX: node.position.x,
                    targetY: (node.position.y || 0) + (node.height || 0),
                };
                // If both lines intersect with the edge line, we can assume the node is intersecting with the edge
                return intersects(nodeLineTLBR, edgeLine) && intersects(nodeLineTRBL, edgeLine);
            });

            // Early exit if there is not an intersecting edge
            if (!intersectingEdge) {
                return;
            }

            // Check if the node has valid connections it can make
            const edgeType = intersectingEdge.data?.type;
            const fn = functionDefinitions.get(node.data.schemaId);
            if (!(fn && edgeType)) {
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
        [createConnection, edges, functionDefinitions, nodes, removeEdgeById]
    );

    const setNodeCollidingEdge = useCallback(
        (node: Node<NodeData>, collidingEdge?: Edge<EdgeData>) => {
            setNodes((sNodes) => {
                const thisNode = sNodes.find((n) => n.id === node.id);
                if (!thisNode) {
                    return nodes;
                }
                return [
                    ...sNodes,
                    {
                        ...thisNode,
                        data: {
                            ...thisNode.data,
                            collidingEdge,
                        },
                    },
                ];
            });
        },
        [nodes, setNodes]
    );

    const setEdgeColliding = useCallback(
        (edge: Edge<EdgeData>, colliding?: boolean) => {
            setEdges((sEdges) => {
                const thisEdge = sEdges.find((e) => e.id === edge.id);
                if (!thisEdge) {
                    return sEdges;
                }
                return [
                    ...sEdges
                        .filter((e) => e.id !== edge.id)
                        .map((e) => ({
                            ...e,
                            data: {
                                ...e.data,
                                colliding: false,
                            },
                        })),
                    {
                        ...thisEdge,
                        data: {
                            ...thisEdge.data,
                            colliding,
                        },
                    },
                ];
            });
        },
        [setEdges]
    );

    const lastEdgeCollisionState = useRef<boolean>(false);
    const onNodeDrag = useCallback(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (event: React.MouseEvent, node: Node<NodeData>, _nodes: Node[]) => {
            if (altPressed) {
                const collisionResp = performNodeOnEdgeCollisionDetection(node, true);
                if (collisionResp?.status === 'success') {
                    if (!collisionResp.intersectingEdge.data?.colliding) {
                        setEdgeColliding(collisionResp.intersectingEdge, true);
                        lastEdgeCollisionState.current = true;
                    }
                    if (!node.data.collidingEdge) {
                        setNodeCollidingEdge(node, collisionResp.intersectingEdge);
                    }
                } else {
                    if (node.data.collidingEdge) {
                        setNodeCollidingEdge(node, undefined);
                    }
                    if (lastEdgeCollisionState.current) {
                        setEdges((sEdges) =>
                            sEdges.map((e) => ({ ...e, data: { ...e.data, colliding: false } }))
                        );
                        lastEdgeCollisionState.current = false;
                    }
                }
            }
        },
        [
            altPressed,
            performNodeOnEdgeCollisionDetection,
            setEdgeColliding,
            setEdges,
            setNodeCollidingEdge,
        ]
    );

    const lastAltPressed = useRef<boolean>(altPressed);
    useEffect(() => {
        if (lastAltPressed.current !== altPressed) {
            lastAltPressed.current = altPressed;
            if (!altPressed) {
                setNodes((sNodes) =>
                    sNodes.map((n) => ({ ...n, data: { ...n.data, collidingEdge: undefined } }))
                );
                setEdges((sEdges) =>
                    sEdges.map((e) => ({ ...e, data: { ...e.data, colliding: false } }))
                );
            }
        }
    }, [altPressed, nodes, setEdges, setNodes]);

    const onNodeDragStop = useCallback(
        (event: React.MouseEvent, node: Node<NodeData> | null, draggedNodes: Node<NodeData>[]) => {
            if (node && altPressed) {
                const collisionResp = performNodeOnEdgeCollisionDetection(node, false);
                if (collisionResp?.status === 'success') {
                    collisionResp.performCombine();
                    if (node.data.collidingEdge) {
                        setNodeCollidingEdge(node, undefined);
                    }
                    if (collisionResp.intersectingEdge.data?.colliding) {
                        setEdgeColliding(collisionResp.intersectingEdge, false);
                    }
                } else {
                    if (node.data.collidingEdge) {
                        setNodeCollidingEdge(node, undefined);
                    }
                    if (lastEdgeCollisionState.current) {
                        setEdges((sEdges) =>
                            sEdges.map((e) => ({ ...e, data: { ...e.data, colliding: false } }))
                        );
                        lastEdgeCollisionState.current = false;
                    }
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
            setNodeCollidingEdge,
            setEdgeColliding,
            setEdges,
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
        setHoveredNode(null);
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
                    setNodes,
                    setEdges,
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
        [createNode, wrapper, reactFlowInstance, schemata, sendAlert, setEdges, setNodes]
    );

    // TODO: I want to get this to work at some point but for now it needs to not exist
    // const onEdgeUpdate = useCallback(
    //     (oldEdge: Edge, newConnection: Connection) => {
    //         return setEdges((els) => updateEdge(oldEdge, newConnection, els));
    //     },
    //     [setEdges]
    // );

    const { onConnectStart, onConnectStop, onPaneContextMenu } = usePaneNodeSearchMenu(wrapperRef);

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
                onSelectionDragStop={onSelectionDragStop}
            >
                <Background
                    gap={16}
                    size={1}
                    variant={BackgroundVariant.Dots}
                />
                <Controls />
            </ReactFlow>
        </Box>
    );
});
