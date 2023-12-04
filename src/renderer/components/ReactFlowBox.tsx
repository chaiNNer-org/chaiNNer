/* eslint-disable @typescript-eslint/no-shadow */
import { Box } from '@chakra-ui/react';
import { Bezier } from 'bezier-js';
import ELK, { ElkNode } from 'elkjs';
import { DragEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaFileExport } from 'react-icons/fa';
import ReactFlow, {
    Background,
    BackgroundVariant,
    ControlButton,
    Controls,
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
import { isMac } from '../../common/env';
import { log } from '../../common/log';
import { getFirstPossibleInput, getFirstPossibleOutput } from '../../common/nodes/connectedInputs';
import {
    EMPTY_ARRAY,
    parseSourceHandle,
    parseTargetHandle,
    stringifySourceHandle,
    stringifyTargetHandle,
} from '../../common/util';
import { AlertBoxContext, AlertType } from '../contexts/AlertBoxContext';
import { BackendContext } from '../contexts/BackendContext';
import { ContextMenuContext } from '../contexts/ContextMenuContext';
import { GlobalContext, GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { SettingsContext } from '../contexts/SettingsContext';
import { DataTransferProcessorOptions, dataTransferProcessors } from '../helpers/dataTransfer';
import { AABB, Point, getBezierPathValues, pointDist } from '../helpers/graphUtils';
import { isSnappedToGrid, snapToGrid } from '../helpers/reactFlowUtil';
import { useHotkeys } from '../hooks/useHotkeys';
import { useIpcRendererListener } from '../hooks/useIpcRendererListener';
import { useMemoArray } from '../hooks/useMemo';
import { useNodesMenu } from '../hooks/useNodesMenu';
import { usePaneNodeSearchMenu } from '../hooks/usePaneNodeSearchMenu';

const elk = new ELK();

const elkOptions = {
    'elk.algorithm': 'layered',
    'elk.layered.spacing.nodeNodeBetweenLayers': '100',
    'elk.spacing.nodeNode': '80',
    'elk.direction': 'RIGHT',
};

// This is basically just copypasta'd from the RF docs
// I just modified it a bit
const getLayoutedElements = async (nodes: Node<NodeData>[], edges: Edge<EdgeData>[]) => {
    const isHorizontal = elkOptions['elk.direction'] === 'RIGHT';
    const graph: ElkNode = {
        id: 'root',
        layoutOptions: elkOptions,
        children: nodes.map((node) => ({
            ...node,
            // Adjust the target and source handle positions based on the layout
            // direction.
            targetPosition: isHorizontal ? 'left' : 'top',
            sourcePosition: isHorizontal ? 'right' : 'bottom',

            // Hardcode a width and height for elk to use when layouting.
            width: node.width || 150,
            height: node.height || 50,
        })),
        edges: edges.map((edge) => ({
            ...edge,
            sources: [edge.source],
            targets: [edge.target],
        })),
    };

    const layoutedGraph = await elk.layout(graph);
    return {
        nodes: layoutedGraph.children?.map((node) => ({
            ...node,
            // React Flow expects a position property on the node instead of `x`
            // and `y` fields.
            position: { x: node.x, y: node.y },
        })),

        edges: layoutedGraph.edges,
    };
};

const compareById = (a: Edge | Node, b: Edge | Node) => a.id.localeCompare(b.id);

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
        exportViewportScreenshotToClipboard,
    } = useContext(GlobalContext);
    const { schemata, functionDefinitions } = useContext(BackendContext);

    const useSnapToGrid = useContextSelector(SettingsContext, (c) => c.useSnapToGrid);
    const animateChain = useContextSelector(SettingsContext, (c) => c.useAnimateChain[0]);
    const [isSnapToGrid, , snapToGridAmount] = useSnapToGrid;

    const typeState = useContextSelector(GlobalVolatileContext, (c) => c.typeState);

    const reactFlowInstance = useReactFlow<NodeData, EdgeData>();

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
        (node: Node<NodeData>, mousePosition: XYPosition) => {
            // First, we need to make sure this node is an orphan. We can do a find so it stops early
            const hasConnectedEdge = !!edges.find(
                (e) => e.source === node.id || e.target === node.id
            );
            if (hasConnectedEdge) {
                return;
            }

            const nodePos: Point = { x: node.position.x || 0, y: node.position.y || 0 };
            const nodeBB = AABB.fromPoints(nodePos, {
                x: nodePos.x + (node.width || 0),
                y: nodePos.y + (node.height || 0),
            });

            const fn = functionDefinitions.get(node.data.schemaId);
            if (!fn) {
                return;
            }

            // Finds the first edge that intersects with the node
            type CandidateEdge = Edge<EdgeData> & {
                data: Required<EdgeData>;
                sourceHandle: string;
                targetHandle: string;
            };
            const intersectingEdges = edges
                .filter((e): e is CandidateEdge => {
                    // if one value is set, all are
                    return Boolean(
                        e.data?.sourceX !== undefined && e.sourceHandle && e.targetHandle
                    );
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
                    const { outputId } = parseSourceHandle(e.sourceHandle);
                    const edgeType = typeState.functions.get(e.source)?.outputs.get(outputId);
                    if (!edgeType) {
                        return EMPTY_ARRAY;
                    }
                    const { inputId } = parseTargetHandle(e.targetHandle);
                    const targetEdgeDefinition = typeState.functions.get(e.target)?.definition;
                    if (!targetEdgeDefinition || !targetEdgeDefinition.hasInput(inputId)) {
                        return EMPTY_ARRAY;
                    }
                    const firstPossibleInput = getFirstPossibleInput(fn, edgeType);
                    const firstPossibleOutput = getFirstPossibleOutput(
                        fn,
                        targetEdgeDefinition,
                        inputId
                    );
                    if (firstPossibleInput === undefined || firstPossibleOutput === undefined) {
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
                    const curve = new Bezier(bezierPathCoordinates);
                    if (!nodeBB.intersectsCurve(curve)) {
                        return EMPTY_ARRAY;
                    }

                    const mouseDist = pointDist(mousePosition, curve.project(mousePosition));
                    return { edge: e, mouseDist, firstPossibleInput, firstPossibleOutput };
                })
                // Sort the edges by their distance from the mouse position
                .sort((a, b) => a.mouseDist - b.mouseDist);

            // Early exit if there is not an intersecting edge
            if (intersectingEdges.length === 0) {
                return;
            }

            const {
                edge: intersectingEdge,
                firstPossibleInput,
                firstPossibleOutput,
            } = intersectingEdges[0];

            const fromNode = nodes.find((n) => n.id === intersectingEdge.source);
            const toNode = nodes.find((n) => n.id === intersectingEdge.target);
            if (!(fromNode && toNode)) {
                return;
            }

            return {
                intersectingEdge,
                performCombine: () => {
                    removeEdgeById(intersectingEdge.id);
                    createConnection({
                        source: fromNode.id,
                        sourceHandle: intersectingEdge.sourceHandle,
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
                        targetHandle: intersectingEdge.targetHandle,
                    });
                },
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
                const collisionResp = performNodeOnEdgeCollisionDetection(node, mousePosition);
                if (collisionResp) {
                    setCollidingEdge(collisionResp.intersectingEdge.id);
                    setCollidingNode(node.id);
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
        (event: React.MouseEvent, node: Node<NodeData> | null) => {
            if (node && altPressed) {
                const mousePosition = {
                    // React flow's type for the event is incorrect. This value exists.
                    x: node.position.x + (event as unknown as MouseEvent).offsetX,
                    y: node.position.y + (event as unknown as MouseEvent).offsetY,
                };
                const collisionResp = performNodeOnEdgeCollisionDetection(node, mousePosition);
                if (collisionResp) {
                    collisionResp.performCombine();
                    setCollidingEdge(collisionResp.intersectingEdge.id);
                    setCollidingNode(node.id);
                } else {
                    setCollidingEdge(undefined);
                    setCollidingNode(undefined);
                }
            }

            addNodeChanges();
            addEdgeChanges();
        },
        [
            altPressed,
            addNodeChanges,
            addEdgeChanges,
            performNodeOnEdgeCollisionDetection,
            setCollidingEdge,
            setCollidingNode,
        ]
    );

    const onSelectionDragStop = useCallback(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (event: React.MouseEvent, nNodes: Node<NodeData>[]) => {
            onNodeDragStop(event, null);
        },
        [onNodeDragStop]
    );

    const onNodesDelete = useCallback(
        (toDelete: readonly Node<NodeData>[]) => {
            changeNodes((nodes) => {
                const ids = new Set(toDelete.map((n) => n.id));
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

    const wrapper = wrapperRef.current;
    const onDrop = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            if (!wrapper) return;

            try {
                const options: DataTransferProcessorOptions = {
                    schemata,
                    createNode,
                    getNodePosition: (offsetX = 0, offsetY = 0) => {
                        const { zoom } = reactFlowInstance.getViewport();
                        return reactFlowInstance.screenToFlowPosition({
                            x: event.clientX - offsetX * zoom,
                            y: event.clientY - offsetY * zoom,
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

    const multiSelectionKeyCode = useMemo(() => (isMac ? ['Meta'] : ['Control']), []);
    const deleteKeyCode = useMemo(
        () => (isMac ? ['Backspace', 'Meta+Backspace'] : ['Backspace', 'Delete']),
        []
    );

    const onLayout = useCallback(() => {
        getLayoutedElements(nodes, edges)
            .then((response) => {
                const { nodes: layoutedNodes } = response;
                if (layoutedNodes) {
                    changeNodes((nds) => {
                        const nodesWithTheirPositionsModified = layoutedNodes.map((node) => {
                            const originalNode = nds.find((n) => n.id === node.id);
                            if (!originalNode) {
                                return undefined;
                            }
                            return {
                                ...originalNode,
                                position: node.position,
                            };
                        });
                        const notUndefined = nodesWithTheirPositionsModified.filter(
                            (n) => n !== undefined
                        ) as Node<NodeData>[];
                        return notUndefined;
                    });
                }
            })
            .catch((error) => {
                log.error(error);
            });
    }, [nodes, edges, changeNodes]);

    useHotkeys('ctrl+shift+f, cmd+shift+f', onLayout);
    useIpcRendererListener('format-chain', onLayout);

    return (
        <Box
            className={animateChain ? '' : 'no-chain-animation'}
            h="100%"
            ref={wrapperRef}
            w="100%"
        >
            <ReactFlow
                elevateEdgesOnSelect
                elevateNodesOnSelect
                connectionLineContainerStyle={{ zIndex: 1000 }}
                connectionRadius={15}
                deleteKeyCode={deleteKeyCode}
                edgeTypes={edgeTypes}
                edges={displayEdges}
                maxZoom={8}
                minZoom={0.125}
                multiSelectionKeyCode={multiSelectionKeyCode}
                nodeTypes={nodeTypes}
                nodes={displayNodes}
                snapGrid={useMemoArray<[number, number]>([snapToGridAmount, snapToGridAmount])}
                snapToGrid={isSnapToGrid}
                style={{
                    zIndex: 0,
                    borderRadius: '0.5rem',
                    backgroundColor: 'var(--chain-editor-bg)',
                }}
                onConnect={createConnection}
                onConnectEnd={onConnectStop}
                onConnectStart={onConnectStart}
                onDragOver={onDragOver}
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
                        title={`Export viewport as PNG file\n\nHold ${
                            isMac ? '⌥' : 'Ctrl'
                        }+Click to export to clipboard`}
                        onClick={(e) => {
                            if (isMac ? e.altKey : e.ctrlKey) {
                                exportViewportScreenshotToClipboard();
                            } else {
                                exportViewportScreenshot();
                            }
                        }}
                    >
                        <FaFileExport />
                    </ControlButton>
                </Controls>
            </ReactFlow>
        </Box>
    );
});
