/* eslint-disable @typescript-eslint/naming-convention */
import { Box, useColorModeValue } from '@chakra-ui/react';
import log from 'electron-log';
import { DragEvent, memo, useCallback, useContext, useEffect, useMemo } from 'react';
import ReactFlow, {
    Background,
    BackgroundVariant,
    Controls,
    Edge,
    EdgeTypes,
    Node,
    NodeTypes,
    ReactFlowInstance,
    useEdgesState,
    useNodesState,
} from 'react-flow-renderer';
import { EdgeData, NodeData, NodeSchema } from '../common-types';
import { GlobalChainContext, GlobalContext } from '../helpers/contexts/GlobalNodeState';
import { MenuFunctionsContext } from '../helpers/contexts/MenuFunctions';
import { SettingsContext } from '../helpers/contexts/SettingsContext';
import { snapToGrid } from '../helpers/reactFlowUtil';

const STARTING_Z_INDEX = 50;

interface ReactFlowBoxProps {
    nodeTypes: NodeTypes;
    edgeTypes: EdgeTypes;
    wrapperRef: React.RefObject<HTMLDivElement>;
}
const ReactFlowBox = ({ wrapperRef, nodeTypes, edgeTypes }: ReactFlowBoxProps) => {
    const { nodes, edges, createNode, createConnection, reactFlowInstance, zoom } =
        useContext(GlobalChainContext);
    const { setReactFlowInstance, setNodes, setEdges, onMoveEnd, setHoveredNode } =
        useContext(GlobalContext);
    const { closeAllMenus } = useContext(MenuFunctionsContext);

    const { useSnapToGrid } = useContext(SettingsContext);

    const [_nodes, _setNodes, onNodesChange] = useNodesState<NodeData>([]);
    const [_edges, _setEdges, onEdgesChange] = useEdgesState<EdgeData>([]);

    const sortNodesAndEdges = useCallback(() => {
        const iterators = nodes.filter((n) => n.type === 'iterator'); // .sort((i) => (i.selected ? 1 : -1));
        let sortedNodes: Node<NodeData>[] = [];

        // Sort the nodes in a way that makes iterators stack on each other correctly
        // Put iterators below their children
        iterators.forEach((_iterator, index) => {
            const iterator = _iterator;
            iterator.zIndex = STARTING_Z_INDEX + index * 5;
            sortedNodes.push(iterator);
            const children = nodes.filter((n) => n.parentNode === iterator.id);
            // sorted.concat(children);
            children.forEach((_child) => {
                const child = _child;
                child.zIndex = STARTING_Z_INDEX + index * 5 + 1;
                // child.position.x = Math.min(Math.max(child.position.x, 0), iterator.width);
                // child.position.y = Math.min(Math.max(child.position.y, 0), iterator.height);
                sortedNodes.push(child);
            });
        });

        // Put nodes not in iterators on top of the iterators
        const freeNodes = nodes.filter((n) => n.type !== 'iterator' && !n.parentNode);
        freeNodes.forEach((f) => {
            sortedNodes.push(f);
        });

        const indexedEdges = edges.map((e) => {
            const index = sortedNodes.find((n) => n.id === e.target)?.zIndex || 1000;
            return { ...e, zIndex: index };
        });

        // This fixes the connection line being behind iterators if no edges are present
        if (indexedEdges.length === 0) {
            sortedNodes = sortedNodes.map((n) => ({ ...n, zIndex: -1 }));
        }

        _setNodes(sortedNodes);
        _setEdges(indexedEdges);
    }, [nodes, edges, _setNodes, _setEdges]);

    useEffect(() => {
        sortNodesAndEdges();
    }, [nodes, edges]);

    const onNodeDragStop = useCallback(() => {
        setNodes(_nodes);
        setEdges(_edges);
    }, [_nodes, _edges]);

    const onNodesDelete = useCallback(
        (_nodesToDelete: readonly Node<NodeData>[]) => {
            // Prevent iterator helpers from being deleted
            const iteratorsToDelete = _nodesToDelete
                .filter((n) => n.type === 'iterator')
                .map((n) => n.id);
            const nodesToDelete = _nodesToDelete.filter(
                (n) =>
                    !(
                        n.type === 'iteratorHelper' &&
                        n.parentNode &&
                        !iteratorsToDelete.includes(n.parentNode)
                    )
            );

            const nodeIds = nodesToDelete.map((n) => n.id);
            const newNodes = nodes.filter((n) => !nodeIds.includes(n.id));
            setNodes(newNodes);
        },
        [_setNodes, _nodes, setNodes, nodes]
    );

    const onEdgesDelete = useCallback(
        (edgesToDelete: readonly Edge<EdgeData>[]) => {
            const edgeIds = edgesToDelete.map((e) => e.id);
            const newEdges = edges.filter((e) => !edgeIds.includes(e.id));
            setEdges(newEdges);
        },
        [setEdges, _edges, edges]
    );

    const memoNodeTypes = useMemo(() => nodeTypes, []);
    const memoEdgeTypes = useMemo(() => edgeTypes, []);

    const [isSnapToGrid, , snapToGridAmount] = useSnapToGrid;

    useEffect(() => {
        if (isSnapToGrid) {
            const alignedNodes = nodes.map((n) => {
                if (n.parentNode) {
                    return n;
                }
                return { ...n, position: snapToGrid(n.position, snapToGridAmount) };
            });
            _setNodes(alignedNodes);
        }
    }, [snapToGridAmount, nodes]);

    const onInit = useCallback(
        (rfi: ReactFlowInstance<NodeData, EdgeData>) => {
            if (!reactFlowInstance) {
                setReactFlowInstance(rfi);
            }
        },
        [reactFlowInstance]
    );

    const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        // eslint-disable-next-line no-param-reassign
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDragStart = useCallback(() => {
        setHoveredNode(null);
    }, []);

    const onDrop = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            // log.info('dropped');
            event.preventDefault();

            if (!reactFlowInstance || !wrapperRef.current) return;

            const reactFlowBounds = wrapperRef.current.getBoundingClientRect();

            try {
                const nodeSchema = JSON.parse(
                    event.dataTransfer.getData('application/reactflow/schema')
                ) as NodeSchema;
                const offsetX = Number(event.dataTransfer.getData('application/reactflow/offsetX'));
                const offsetY = Number(event.dataTransfer.getData('application/reactflow/offsetY'));

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
        [createNode, wrapperRef.current, zoom, reactFlowInstance]
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const onNodeContextMenu = useCallback((event, node) => {
        // TODO implement this
    }, []);

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
                edgeTypes={memoEdgeTypes}
                edges={_edges}
                maxZoom={8}
                minZoom={0.125}
                nodeTypes={memoNodeTypes}
                nodes={_nodes}
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
                // onSelectionChange={setSelectedElements}
                onInit={onInit}
                onMoveEnd={onMoveEnd}
                onNodeContextMenu={onNodeContextMenu}
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
