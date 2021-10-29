/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Box,
} from '@chakra-ui/react';
import React, {
  createContext, useCallback, useContext, useEffect, useState,
} from 'react';
import ReactFlow, { Background, Controls, useZoomPanHelper } from 'react-flow-renderer';
import { GlobalContext } from '../helpers/GlobalNodeState.jsx';

export const NodeDataContext = createContext({});

// eslint-disable-next-line react/prop-types
function ReactFlowBox({
  wrapperRef, nodeTypes,
}) {
  const { transform } = useZoomPanHelper();

  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  const {
    elements, createNode, createConnection, setElements, removeElements,
  } = useContext(GlobalContext);

  useEffect(() => {
    const flow = JSON.parse(sessionStorage.getItem('rfi'));
    console.log('🚀 ~ file: ReactFlowBox.jsx ~ line 28 ~ useEffect ~ flow', flow);
    if (flow) {
      const [x = 0, y = 0] = flow.position;
      setElements(flow.elements || []);
      transform({ x, y, zoom: flow.zoom || 0 });
    }
  }, []);

  useEffect(() => {
    if (reactFlowInstance) {
      const flow = reactFlowInstance.toObject();
      sessionStorage.setItem('rfi', JSON.stringify(flow));
    }
  }, [elements, reactFlowInstance]);

  const onNodeDragStop = useCallback(() => {
    if (reactFlowInstance) {
      const flow = reactFlowInstance.toObject();
      sessionStorage.setItem('rfi', JSON.stringify(flow));
    }
  }, [elements, reactFlowInstance, transform]);

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
  };

  const onConnect = useCallback(
    (params) => {
      createConnection(params);
    }, [],
  );

  return (
    <Box w="100%" h="100%" borderWidth="1px" borderRadius="lg" ref={wrapperRef}>
      <ReactFlow
        elements={elements}
        onConnect={onConnect}
        onElementsRemove={removeElements}
        onLoad={onLoad}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        style={{ zIndex: 0 }}
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
}

export default ReactFlowBox;
