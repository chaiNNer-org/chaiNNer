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
    const iterators = nodes.filter((n) => n.type === 'iterator').sort((i) => (i.selected ? 1 : -1));
    const sorted = [];

    // Sort the nodes in a way that makes iterators stack on each other correctly
    // Put iterators below their children
    iterators.forEach((i) => {
      sorted.push(i);
      const children = nodes.filter((n) => n.parentNode === i.id);
      // sorted.concat(children);
      children.forEach((c) => {
        sorted.push(c);
      });
    });

    // Put nodes not in iterators on top of the iterators
    const freeNodes = nodes.filter((n) => n.type !== 'iterator' && !n.parentNode);
    freeNodes.forEach((f) => {
      sorted.push(f);
    });

    _setNodes(sorted);
    _setEdges(edges);
  }, [nodes, edges]);

  const onNodeDragStop = useCallback(() => {
    setNodes(_nodes);
    setEdges(_edges);
  }, [_nodes, _edges]);

  const onNodesDelete = useCallback((nodesToDelete) => {
    const nodeIds = nodesToDelete.map((n) => n.id);
    const newNodes = _nodes.filter((n) => nodeIds.includes(n.id));
    setNodes(newNodes);
  }, [setNodes]);

  const onEdgesDelete = useCallback((edgesToDelete) => {
    const edgeIds = edgesToDelete.map((e) => e.id);
    const newEdges = _edges.filter((e) => edgeIds.includes(e.id));
    setEdges(newEdges);
  }, [setEdges]);

  const memoNodeTypes = useMemo(() => (nodeTypes), []);
  const memoEdgeTypes = useMemo(() => (edgeTypes), []);

  const [isSnapToGrid, , snapToGridAmount] = useSnapToGrid;

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
        type, position, data: nodeData, nodeType,
      });
    } catch (error) {
      log.error(error);
      console.log('Oops! This probably means something was dragged here that should not have been.');
    }
  }, [createNode, wrapperRef.current, zoom]);

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
        snapGrid={[snapToGridAmount, snapToGridAmount]}
        fitView
        fitViewOptions={{
          minZoom: 1,
          maxZoom: 1,
          padding: 40,
        }}
        // onlyRenderVisibleElements
        deleteKeyCode={['Backspace', 'Delete']}
        onMoveEnd={onMoveEnd}
        defaultEdgeOptions={{ zIndex: 1001 }}
        // connectionLineStyle={{
        //   zIndex: 99999999,
        // }}
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
