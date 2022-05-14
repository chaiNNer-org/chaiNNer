/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-restricted-syntax */
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
    useEdgesState,
    useNodesState,
    useReactFlow,
    Viewport,
} from 'react-flow-renderer';
import { useContext, useContextSelector } from 'use-context-selector';
import { EdgeData, NodeData, NodeSchema } from '../common-types';
import { GlobalVolatileContext, GlobalContext } from '../helpers/contexts/GlobalNodeState';
import { MenuFunctionsContext } from '../helpers/contexts/MenuFunctions';
import { SettingsContext } from '../helpers/contexts/SettingsContext';
import { isSnappedToGrid, snapToGrid } from '../helpers/reactFlowUtil';

const STARTING_Z_INDEX = 50;
/**
 * We want the nodes and edges to form the following layers:
 *
 * - Iterator nodes
 * - Nodes inside iterators
 * - Free nodes
 * - Selected nodes
 *   - Same layers within selected nodes as outside
 *
 * Note that child nodes of selected iterator nodes are implicitly selected as well.
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
    const FREE_NODES_INDEX = ITERATOR_CHILDREN_INDEX + 2;
    const SELECTED_ADD = 10;
    const MIN_SELECTED_INDEX = STARTING_Z_INDEX + SELECTED_ADD;

    const selectedIterators = new Set<string>();
    const nodeZIndexes = new Map<string, number>();

    // set the zIndex of all nodes
    for (const n of nodes) {
        let zIndex;
        if (n.type === 'iterator') {
            zIndex = ITERATOR_INDEX;
            if (n.selected) selectedIterators.add(n.id);
        } else if (n.parentNode) {
            zIndex = ITERATOR_CHILDREN_INDEX;
        } else {
            zIndex = FREE_NODES_INDEX;
        }

        if (n.selected) zIndex += SELECTED_ADD;

        n.zIndex = zIndex;
        nodeZIndexes.set(n.id, zIndex);
    }

    // fix up the child nodes of selected iterators
    if (selectedIterators.size > 0) {
        // all child nodes of selected iterators are implicitly selected
        for (const n of nodes) {
            if (selectedIterators.has(n.parentNode!)) {
                const zIndex = ITERATOR_CHILDREN_INDEX + SELECTED_ADD;

                n.zIndex = zIndex;
                nodeZIndexes.set(n.id, zIndex);
            }
        }
    }

    // set the zIndex of all edges
    for (const e of edges) {
        let zIndex = Math.max(
            nodeZIndexes.get(e.source) ?? STARTING_Z_INDEX,
            nodeZIndexes.get(e.target) ?? STARTING_Z_INDEX
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
    const { createNode, createConnection } = useContext(GlobalVolatileContext);
    const {
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

            const reactFlowBounds = wrapperRef.current.getBoundingClientRect();

            try {
                const nodeSchema = JSON.parse(
                    event.dataTransfer.getData('application/reactflow/schema')
                ) as NodeSchema;
                const offsetX = Number(event.dataTransfer.getData('application/reactflow/offsetX'));
                const offsetY = Number(event.dataTransfer.getData('application/reactflow/offsetY'));

                const { zoom } = reactFlowInstance.getViewport();
                const position = reactFlowInstance.project({
                    x: event.clientX - reactFlowBounds.left - offsetX * zoom,
                    y: event.clientY - reactFlowBounds.top - offsetY * zoom,
                });

                const nodeData = {
                    schemaId: nodeSchema.schemaId,
                    category: nodeSchema.category,
                    type: nodeSchema.name,
                    icon: nodeSchema.icon,
                    subcategory: nodeSchema.subcategory,
                };

                createNode({
                    position,
                    data: nodeData,
                    nodeType: nodeSchema.nodeType,
                });
            } catch (error) {
                log.error(error);
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
                onMouseDown={closeAllMenus}
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
