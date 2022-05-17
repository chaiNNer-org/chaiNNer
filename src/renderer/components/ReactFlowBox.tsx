/* eslint-disable @typescript-eslint/no-shadow */
import { Box, useColorModeValue } from '@chakra-ui/react';
import log from 'electron-log';
import { DragEvent, memo, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
    Background,
    BackgroundVariant,
    Controls,
    Edge,
    EdgeTypes,
    Node,
    NodeTypes,
    Viewport,
    useEdgesState,
    useNodesState,
    useReactFlow,
} from 'react-flow-renderer';
import { useContext, useContextSelector } from 'use-context-selector';
import { EdgeData, NodeData } from '../../common/common-types';
import { AlertBoxContext, AlertType } from '../contexts/AlertBoxContext';
import { GlobalContext, GlobalVolatileContext } from '../contexts/GlobalNodeState';
import { MenuFunctionsContext } from '../contexts/MenuFunctions';
import { SettingsContext } from '../contexts/SettingsContext';
import { DataTransferProcessorOptions, dataTransferProcessors } from '../helpers/dataTransfer';
import { isSnappedToGrid, snapToGrid } from '../helpers/reactFlowUtil';

const STARTING_Z_INDEX = 50;
/**
 * We want the nodes and edges to form the following layers:
 *
 * - Iterator nodes
 * - Nodes inside iterators
 * - Related iterator nodes
 * - Related nodes inside iterators
 * - Free nodes
 * - Selected nodes
 *   - Iterator nodes
 *   - Nodes inside iterators
 *   - Free nodes
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
    const ITERATOR_INDEX = STARTING_Z_INDEX;
    const ITERATOR_CHILDREN_INDEX = ITERATOR_INDEX + 2;
    const RELATED_ITERATOR_INDEX = ITERATOR_CHILDREN_INDEX + 2;
    const RELATED_ITERATOR_CHILDREN_INDEX = RELATED_ITERATOR_INDEX + 2;
    const FREE_NODES_INDEX = RELATED_ITERATOR_CHILDREN_INDEX + 2;
    const SELECTED_ADD = 20;
    const MIN_SELECTED_INDEX = STARTING_Z_INDEX + SELECTED_ADD;

    const selectedIterators = new Set<string>();
    const relatedIterators = new Set<string>();

    const byId = new Map<string, Node<unknown>>();

    // set the zIndex of all nodes
    for (const n of nodes) {
        byId.set(n.id, n);

        let zIndex;
        if (n.type === 'iterator') {
            zIndex = ITERATOR_INDEX;
            if (n.selected) {
                selectedIterators.add(n.id);
                relatedIterators.delete(n.id);
            }
        } else if (n.parentNode) {
            zIndex = ITERATOR_CHILDREN_INDEX;
            if (n.selected && !selectedIterators.has(n.parentNode)) {
                relatedIterators.add(n.parentNode);
            }
        } else {
            zIndex = FREE_NODES_INDEX;
        }

        if (n.selected) zIndex += SELECTED_ADD;

        n.zIndex = zIndex;
    }

    // fix up the child nodes of selected iterators
    if (selectedIterators.size > 0 || relatedIterators.size > 0) {
        // all child nodes of selected iterators are implicitly selected
        for (const n of nodes) {
            if (selectedIterators.has(n.parentNode!)) {
                n.zIndex = ITERATOR_CHILDREN_INDEX + SELECTED_ADD;
            } else if (relatedIterators.has(n.id)) {
                n.zIndex = RELATED_ITERATOR_INDEX;
            } else if (relatedIterators.has(n.parentNode!) && !n.selected) {
                n.zIndex = RELATED_ITERATOR_CHILDREN_INDEX;
            }
        }
    }

    // set the zIndex of all edges
    for (const e of edges) {
        let zIndex = Math.max(
            byId.get(e.source)?.zIndex ?? STARTING_Z_INDEX,
            byId.get(e.target)?.zIndex ?? STARTING_Z_INDEX
        );

        if (e.selected && zIndex < MIN_SELECTED_INDEX) {
            zIndex += SELECTED_ADD;
        }

        e.zIndex = zIndex - 1;
    }
};

interface ReactFlowBoxProps {
    nodeTypes: NodeTypes;
    edgeTypes: EdgeTypes;
    wrapperRef: React.RefObject<HTMLDivElement>;
}
const ReactFlowBox = ({ wrapperRef, nodeTypes, edgeTypes }: ReactFlowBoxProps) => {
    const { sendAlert } = useContext(AlertBoxContext);
    const { createNode, createConnection } = useContext(GlobalVolatileContext);
    const {
        schemata,
        setZoom,
        setHoveredNode,
        addNodeChanges,
        addEdgeChanges,
        changeNodes,
        changeEdges,
        setSetNodes,
        setSetEdges,
    } = useContext(GlobalContext);
    const { closeAllMenus } = useContext(MenuFunctionsContext);

    const useSnapToGrid = useContextSelector(SettingsContext, (c) => c.useSnapToGrid);
    const [isSnapToGrid, , snapToGridAmount] = useSnapToGrid;

    const reactFlowInstance = useReactFlow();

    const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<EdgeData>([]);

    useEffect(() => {
        setSetNodes(() => setNodes);
        setSetEdges(() => setEdges);
    }, [setNodes, setEdges]);

    const selectedNodesKey = useMemo(
        () =>
            nodes
                .filter((n) => n.selected)
                .map((n) => n.id)
                .join(''),
        [nodes]
    );
    const selectedEdgesKey = useMemo(
        () =>
            edges
                .filter((e) => e.selected)
                .map((e) => e.id)
                .join(''),
        [edges]
    );

    // We don't want this to cause a re-render, so we will commit the greatest sin
    // known to React developers: interior mutation.
    useMemo(() => {
        nodes.sort((a, b) => a.id.localeCompare(b.id));
    }, [nodes.length]);
    useMemo(() => {
        edges.sort((a, b) => a.id.localeCompare(b.id));
    }, [edges.length]);
    useMemo(
        () => updateZIndexes(nodes, edges),
        [nodes.length, edges.length, selectedNodesKey, selectedEdgesKey]
    );
    useMemo(() => {
        if (!isSnapToGrid) return;
        for (const n of nodes) {
            if (!isSnappedToGrid(n.position, snapToGridAmount)) {
                n.position = snapToGrid(n.position, snapToGridAmount);
            }
        }
    }, [isSnapToGrid && snapToGridAmount, nodes]);

    const onNodeDragStop = useCallback(() => {
        addNodeChanges();
        addEdgeChanges();
    }, [addNodeChanges, addEdgeChanges]);

    const onNodesDelete = useCallback(
        (_nodesToDelete: readonly Node<NodeData>[]) => {
            const nodeIds = new Set(_nodesToDelete.map((n) => n.id));

            changeNodes((nodes) =>
                nodes.filter((n) => {
                    if (nodeIds.has(n.id)) {
                        if (n.type === 'iteratorHelper') {
                            // only delete iterator helper if the iterator itself is also removed
                            return !nodeIds.has(n.parentNode!);
                        }
                        return false;
                    }
                    return true;
                })
            );
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

    const onDragOver = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            closeAllMenus();
            event.preventDefault();
            // eslint-disable-next-line no-param-reassign
            event.dataTransfer.dropEffect = 'move';
        },
        [closeAllMenus]
    );

    const onDragStart = useCallback(() => {
        setHoveredNode(null);
    }, [setHoveredNode]);

    const onDrop = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            if (!wrapperRef.current) return;

            try {
                const reactFlowBounds = wrapperRef.current.getBoundingClientRect();

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
        [createNode, wrapperRef.current, reactFlowInstance]
    );

    return (
        <Box
            bg={useColorModeValue('gray.100', 'gray.800')}
            borderRadius="lg"
            borderWidth="1px"
            h="100%"
            ref={wrapperRef}
            w="100%"
        >
            <ReactFlow
                deleteKeyCode={useMemo(() => ['Backspace', 'Delete'], [])}
                edgeTypes={edgeTypes}
                edges={edges}
                maxZoom={8}
                minZoom={0.125}
                nodeTypes={nodeTypes}
                nodes={nodes}
                snapGrid={useMemo(() => [snapToGridAmount, snapToGridAmount], [snapToGridAmount])}
                snapToGrid={isSnapToGrid}
                style={{
                    zIndex: 0,
                    borderRadius: '0.5rem',
                }}
                onConnect={createConnection}
                onDragOver={onDragOver}
                onDragStart={onDragStart}
                onDrop={onDrop}
                onEdgesChange={onEdgesChange}
                onEdgesDelete={onEdgesDelete}
                onMoveEnd={onMoveEnd}
                onMoveStart={closeAllMenus}
                onNodeDragStop={onNodeDragStop}
                onNodesChange={onNodesChange}
                onNodesDelete={onNodesDelete}
                onPaneClick={closeAllMenus}
            >
                <Background
                    gap={16}
                    size={0.5}
                    variant={BackgroundVariant.Dots}
                />
                <Controls />
            </ReactFlow>
        </Box>
    );
};

export default memo(ReactFlowBox);
