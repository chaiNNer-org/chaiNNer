/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Box, useColorModeValue,
} from '@chakra-ui/react';
import log from 'electron-log';
// import PillPity from 'pill-pity';
import React, {
  createContext, memo, useCallback, useContext, useEffect, useMemo,
} from 'react';
import ReactFlow, {
  Background, Controls, useEdgesState, useNodesState,
} from 'react-flow-renderer';
import { GlobalContext } from '../helpers/GlobalNodeState.jsx';

export const NodeDataContext = createContext({});

const STARTING_Z_INDEX = 50;

// eslint-disable-next-line react/prop-types
const ReactFlowBox = ({
  wrapperRef, nodeTypes, edgeTypes,
}) => {
  const {
    nodes, edges, createNode, createConnection,
    reactFlowInstance, setReactFlowInstance,
    useSnapToGrid, setNodes, setEdges, onMoveEnd, zoom,
  } = useContext(GlobalContext);

  const [_nodes, _setNodes, onNodesChange] = useNodesState([]);
  const [_edges, _setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const iterators = nodes.filter((n) => n.type === 'iterator'); // .sort((i) => (i.selected ? 1 : -1));
    const sorted = [];

    // Sort the nodes in a way that makes iterators stack on each other correctly
    // Put iterators below their children
    iterators.forEach((_iterator, index) => {
      const iterator = _iterator;
      iterator.zIndex = STARTING_Z_INDEX + (index * 5);
      sorted.push(iterator);
      const children = nodes.filter((n) => n.parentNode === iterator.id);
      // sorted.concat(children);
      children.forEach((_child) => {
        const child = _child;
        child.zIndex = STARTING_Z_INDEX + (index * 5) + 1;
        // child.position.x = Math.min(Math.max(child.position.x, 0), iterator.width);
        // child.position.y = Math.min(Math.max(child.position.y, 0), iterator.height);
        sorted.push(child);
      });
    });

    // Put nodes not in iterators on top of the iterators
    const freeNodes = nodes.filter((n) => n.type !== 'iterator' && !n.parentNode);
    freeNodes.forEach((f) => {
      sorted.push(f);
    });

    const indexedEdges = edges.map((e) => {
      const index = (sorted.find((n) => n.id === e.target)?.zIndex || 1000);
      return ({ ...e, zIndex: index });
    });

    _setNodes(sorted);
    _setEdges(indexedEdges);
  }, [nodes, edges]);

  const onNodeDragStop = useCallback(() => {
    setNodes(_nodes);
    setEdges(_edges);
  }, [_nodes, _edges]);

  const onNodesDelete = useCallback((_nodesToDelete) => {
    // Prevent iterator helpers from being deleted
    const iteratorsToDelete = _nodesToDelete.filter((n) => n.type === 'iterator').map((n) => n.id);
    const nodesToDelete = _nodesToDelete.filter((n) => !(n.type === 'iteratorHelper' && !iteratorsToDelete.includes(n.parentNode)));

    const nodeIds = nodesToDelete.map((n) => n.id);
    const newNodes = nodes.filter((n) => !nodeIds.includes(n.id));
    setNodes(newNodes);
  }, [_setNodes, _nodes, setNodes, nodes]);

  const onEdgesDelete = useCallback((edgesToDelete) => {
    const edgeIds = edgesToDelete.map((e) => e.id);
    const newEdges = edges.filter((e) => !edgeIds.includes(e.id));
    setEdges(newEdges);
  }, [setEdges, _edges, edges]);

  const memoNodeTypes = useMemo(() => (nodeTypes), []);
  const memoEdgeTypes = useMemo(() => (edgeTypes), []);

  const [isSnapToGrid, , snapToGridAmount] = useSnapToGrid;

  useEffect(() => {
    if (isSnapToGrid) {
      const alignedNodes = nodes.map((n) => {
        if (n.parentNode) {
          return n;
        }
        return {
          ...n,
          position: {
            x: n.position.x - (n.position.x % snapToGridAmount),
            y: n.position.y - (n.position.y % snapToGridAmount),
          },
        };
      });
      _setNodes(alignedNodes);
    }
  }, [snapToGridAmount, nodes]);

  const onInit = useCallback(
    (rfi) => {
      if (!reactFlowInstance) {
        setReactFlowInstance(rfi);
        console.log('flow loaded:', rfi);
      }
    },
    [reactFlowInstance],
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    // eslint-disable-next-line no-param-reassign
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    // log.info('dropped');
    event.preventDefault();

    const reactFlowBounds = wrapperRef.current.getBoundingClientRect();

    try {
      const type = event.dataTransfer.getData('application/reactflow/type');
      const nodeType = event.dataTransfer.getData('application/reactflow/nodeType');
      // const inputs = JSON.parse(event.dataTransfer.getData('application/reactflow/inputs'));
      // const outputs = JSON.parse(event.dataTransfer.getData('application/reactflow/outputs'));
      const category = event.dataTransfer.getData('application/reactflow/category');
      const icon = event.dataTransfer.getData('application/reactflow/icon');
      const subcategory = event.dataTransfer.getData('application/reactflow/subcategory');
      const offsetX = event.dataTransfer.getData('application/reactflow/offsetX');
      const offsetY = event.dataTransfer.getData('application/reactflow/offsetY');
      const defaultNodes = nodeType === 'iterator' ? JSON.parse(event.dataTransfer.getData('application/reactflow/defaultNodes')) : null;
      // log.info(type, inputs, outputs, category);

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left - (offsetX * zoom),
        y: event.clientY - reactFlowBounds.top - (offsetY * zoom),
      });

      const nodeData = {
        category,
        type,
        icon,
        subcategory,
      };

      createNode({
        type, position, data: nodeData, nodeType, defaultNodes,
      });
    } catch (error) {
      log.error(error);
      console.log('Oops! This probably means something was dragged here that should not have been.');
    }
  }, [createNode, wrapperRef.current, zoom, reactFlowInstance]);

  const onNodeContextMenu = useCallback((event, node) => {
    console.log(event, node);
  }, []);

  // const onConnect = useCallback(
  //   (params) => {
  //     createConnection(params);
  //   }, [],
  // );

  return (
    <Box w="100%" h="100%" borderWidth="1px" borderRadius="lg" ref={wrapperRef} bg={useColorModeValue('gray.100', 'gray.800')}>
      <ReactFlow
        nodes={_nodes}
        edges={_edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgesDelete={onEdgesDelete}
        onNodesDelete={onNodesDelete}
        onConnect={createConnection}
        onInit={onInit}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={memoNodeTypes}
        edgeTypes={memoEdgeTypes}
        onNodeContextMenu={onNodeContextMenu}
        style={{
          zIndex: 0,
          borderRadius: '0.5rem',
        }}
        // onSelectionChange={setSelectedElements}
        maxZoom={8}
        minZoom={0.125}
        snapToGrid={isSnapToGrid}
        snapGrid={useMemo(() => [snapToGridAmount, snapToGridAmount], [snapToGridAmount])}
        // fitView
        // fitViewOptions={{
        //   minZoom: 1,
        //   maxZoom: 1,
        //   padding: 40,
        // }}
        // onlyRenderVisibleElements
        deleteKeyCode={useMemo(() => ['Backspace', 'Delete'], [])}
        onMoveEnd={onMoveEnd}
        // defaultEdgeOptions={{ zIndex: 1001 }}
      >
        <Background
          variant="dots"
          gap={16}
          size={0.5}
        />
        {/* Would be cool to use this in the future */}
        {/* <PillPity
          pattern="topography"
          as={Background}
          align="center"
          justify="center"
          fontWeight="bold"
          boxSize="200px"
          patternFill={useColorModeValue('brand.200', 'brand.300')}
          bgColor="choc.secondary"
          patternOpacity={0.3}
        /> */}

        <Controls />
      </ReactFlow>
    </Box>
  );
};

export default memo(ReactFlowBox);
