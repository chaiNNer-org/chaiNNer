/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Box,
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
  // console.log('flow box rerender');
  const {
    nodes, edges, createNode, createConnection,
    reactFlowInstance, setReactFlowInstance,
    useSnapToGrid, setNodes, setEdges, onMoveEnd,
  } = useContext(GlobalContext);

  const [_nodes, _setNodes, onNodesChange] = useNodesState([]);
  const [_edges, _setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    console.log('setting internal node state');
    _setNodes(nodes);
    _setEdges(edges);
  }, [nodes, edges]);

  const onNodeDragStop = useCallback(() => {
    console.log('setting global node state');
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
      // const inputs = JSON.parse(event.dataTransfer.getData('application/reactflow/inputs'));
      // const outputs = JSON.parse(event.dataTransfer.getData('application/reactflow/outputs'));
      const category = event.dataTransfer.getData('application/reactflow/category');
      const icon = event.dataTransfer.getData('application/reactflow/icon');
      const subcategory = event.dataTransfer.getData('application/reactflow/subcategory');
      const offsetX = event.dataTransfer.getData('application/reactflow/offsetX');
      const offsetY = event.dataTransfer.getData('application/reactflow/offsetY');
      // log.info(type, inputs, outputs, category);

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left - offsetX,
        y: event.clientY - reactFlowBounds.top - offsetY,
      });

      const nodeData = {
        category,
        type,
        // inputs,
        // outputs,
        icon,
        subcategory,
      };

      createNode({ type: 'regularNode', position, data: nodeData });
    } catch (error) {
      log.error(error);
      console.log('Oops! This probably means something was dragged here that should not have been.');
    }
  }, [createNode, wrapperRef.current]);

  const onNodeContextMenu = useCallback((event, node) => {
    console.log(event, node);
  }, []);

  // const onConnect = useCallback(
  //   (params) => {
  //     createConnection(params);
  //   }, [],
  // );

  return (
    <Box w="100%" h="100%" borderWidth="1px" borderRadius="lg" ref={wrapperRef}>
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
        style={{ zIndex: 0 }}
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
