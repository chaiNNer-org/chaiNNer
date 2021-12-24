/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Box,
} from '@chakra-ui/react';
import React, {
  createContext, useCallback, useContext,
} from 'react';
import ReactFlow, { Background, Controls } from 'react-flow-renderer';
import { GlobalContext } from '../helpers/GlobalNodeState.jsx';

export const NodeDataContext = createContext({});

// eslint-disable-next-line react/prop-types
const ReactFlowBox = function ({
  wrapperRef, nodeTypes, edgeTypes,
}) {
  const {
    elements, createNode, createConnection, reactFlowInstance,
    setReactFlowInstance, removeElements, updateRfi, setSelectedElements,
  } = useContext(GlobalContext);

  const onLoad = useCallback(
    (rfi) => {
      if (!reactFlowInstance) {
        setReactFlowInstance(rfi);
        console.log('flow loaded:', rfi);
      }
    },
    [reactFlowInstance],
  );

  const onDragOver = (event) => {
    event.preventDefault();
    // eslint-disable-next-line no-param-reassign
    event.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (event) => {
    event.preventDefault();

    const reactFlowBounds = wrapperRef.current.getBoundingClientRect();

    try {
      const type = event.dataTransfer.getData('application/reactflow/type');
      const inputs = JSON.parse(event.dataTransfer.getData('application/reactflow/inputs'));
      const outputs = JSON.parse(event.dataTransfer.getData('application/reactflow/outputs'));
      const category = event.dataTransfer.getData('application/reactflow/category');
      const offsetX = event.dataTransfer.getData('application/reactflow/offsetX');
      const offsetY = event.dataTransfer.getData('application/reactflow/offsetY');

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left - offsetX,
        y: event.clientY - reactFlowBounds.top - offsetY,
      });

      const nodeData = {
        category,
        type,
        inputs,
        outputs,
      };

      createNode({ type, position, data: nodeData });
    } catch (error) {
      console.log('Oops! This probably means something was dragged here that should not have been.');
    }
  };

  const onNodeContextMenu = (event, node) => {
    console.log(event, node);
  };

  // const onConnect = useCallback(
  //   (params) => {
  //     createConnection(params);
  //   }, [],
  // );

  return (
    <Box w="100%" h="100%" borderWidth="1px" borderRadius="lg" ref={wrapperRef}>
      <ReactFlow
        elements={elements}
        onConnect={createConnection}
        onElementsRemove={removeElements}
        onLoad={onLoad}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStop={updateRfi}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeContextMenu={onNodeContextMenu}
        style={{ zIndex: 0 }}
        onSelectionChange={setSelectedElements}
      >
        <Background
          variant="dots"
          gap={16}
          size={0.5}
        />
        <Controls />
      </ReactFlow>
    </Box>
  );
};

export default ReactFlowBox;
