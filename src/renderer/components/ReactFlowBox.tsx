/* eslint-disable @typescript-eslint/no-shadow */
import { Box } from '@chakra-ui/react';
import { DragEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaFileExport } from 'react-icons/fa';
import ReactFlow, {
    Background,
    BackgroundVariant,
    ControlButton,
    Controls,
    Edge,
    EdgeTypes,
    MiniMap,
    Node,
    NodeTypes,
    OnEdgesChange,
    OnNodesChange,
    Viewport,
    XYPosition,
    useEdgesState,
    useKeyPress,
    useNodesState,
    useReactFlow,
} from 'reactflow';
import { useContext, useContextSelector } from 'use-context-selector';
import { Vec2 } from '../../common/2d';
import { EdgeData, NodeData } from '../../common/common-types';
import { log } from '../../common/log';
import { getFirstPossibleInput, getFirstPossibleOutput } from '../../common/nodes/connectedInputs';
import {
    EMPTY_ARRAY,
    parseSourceHandle,
    parseTargetHandle,
    stringifySourceHandle,
    stringifyTargetHandle,
} from '../../common/util';
import { isMac } from '../appConstants';
import { AlertBoxContext, AlertType } from '../contexts/AlertBoxContext';
import { BackendContext } from '../contexts/BackendContext';
import { ContextMenuContext } from '../contexts/ContextMenuContext';
import { GlobalContext, GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { DataTransferProcessorOptions, dataTransferProcessors } from '../helpers/dataTransfer';
import { AABB, getLayoutedPositionMap, getNodeOnEdgeIntersection } from '../helpers/graphUtils';
import { isSnappedToGrid, snapToGrid } from '../helpers/reactFlowUtil';
import { useHotkeys } from '../hooks/useHotkeys';
import { useIpcRendererListener } from '../hooks/useIpcRendererListener';
import { useMemoArray } from '../hooks/useMemo';
import { useNodesMenu } from '../hooks/useNodesMenu';
import { usePaneNodeSearchMenu } from '../hooks/usePaneNodeSearchMenu';
import { useSettings } from '../hooks/useSettings';

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

    const { snapToGrid: isSnapToGrid, snapToGridAmount, animateChain, showMinimap } = useSettings();

    const typeState = useContextSelector(GlobalVolatileContext, (c) => c.typeState);
    const chainLineage = useContextSelector(GlobalVolatileContext, (c) => c.chainLineage);

    const reactFlowInstance = useReactFlow<NodeData, EdgeData>();
    const { getNode } = reactFlowInstance;

    const [nodes, setNodes, internalOnNodesChange] = useNodesState<NodeData>([]);
    const [edges, setEdges, internalOnEdgesChange] = useEdgesState<EdgeData>([]);
    useEffect(() => {
        setNodesRef.current = setNodes;
        setEdgesRef.current = setEdges;
    }, [setNodes, setEdges, setNodesRef, setEdgesRef]);

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

            const nodePos = Vec2.from(node.position);
            const nodeBB = AABB.fromPoints(
                nodePos,
                nodePos.add({ x: node.width || 0, y: node.height || 0 })
            );

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
                    const sourceP = new Vec2(e.data.sourceX, e.data.sourceY);
                    const targetP = new Vec2(e.data.targetX, e.data.targetY);

                    // check node and edge bounding boxes
                    const edgeBB = AABB.fromPoints(sourceP, targetP);
                    if (!nodeBB.intersects(edgeBB)) {
                        return EMPTY_ARRAY;
                    }

                    // Check if the node has valid connections it can make
                    // If it doesn't, we don't need to bother checking collision
                    const sourceHandle = parseSourceHandle(e.sourceHandle);
                    const { outputId } = sourceHandle;
                    const { inputId } = parseTargetHandle(e.targetHandle);
                    const edgeType = typeState.functions.get(e.source)?.outputs.get(outputId);
                    const targetEdgeDefinition = typeState.functions.get(e.target)?.definition;
                    if (!edgeType || !targetEdgeDefinition) {
                        return EMPTY_ARRAY;
                    }
                    const firstPossibleInput = getFirstPossibleInput(
                        fn,
                        edgeType,
                        chainLineage.getOutputLineage(sourceHandle) !== null
                    );
                    const firstPossibleOutput = getFirstPossibleOutput(
                        fn,
                        targetEdgeDefinition,
                        inputId
                    );
                    if (firstPossibleInput === undefined || firstPossibleOutput === undefined) {
                        return EMPTY_ARRAY;
                    }

                    const leftNode = getNode(sourceHandle.nodeId);
                    const rightNode = getNode(e.target);

                    if (!leftNode || !rightNode) {
                        return EMPTY_ARRAY;
                    }

                    const mouseDist = getNodeOnEdgeIntersection(
                        leftNode,
                        rightNode,
                        nodeBB,
                        sourceP,
                        targetP,
                        mousePosition
                    );

                    if (mouseDist === null) {
                        return EMPTY_ARRAY;
                    }

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
        [
            edges,
            functionDefinitions,
            nodes,
            typeState.functions,
            chainLineage,
            getNode,
            removeEdgeById,
            createConnection,
        ]
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

    const { onConnectStart, onConnectStop, onPaneContextMenu } = usePaneNodeSearchMenu();

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
        getLayoutedPositionMap(nodes, edges, isSnapToGrid ? snapToGridAmount : undefined)
            .then((positionMap) => {
                changeNodes((nds) => {
                    return nds.map((node) => {
                        const newPosition = positionMap.get(node.id);
                        return {
                            ...node,
                            position: newPosition ?? node.position,
                        };
                    });
                });
            })
            .catch((error) => {
                log.error(error);
            });
    }, [nodes, edges, isSnapToGrid, snapToGridAmount, changeNodes]);

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
                {showMinimap && (
                    <MiniMap
                        pannable
                        zoomable
                        ariaLabel=""
                        zoomStep={3}
                    />
                )}
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
