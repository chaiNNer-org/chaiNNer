/* eslint-disable react/prop-types */
import {
  Box,
} from '@chakra-ui/react';
import React from 'react';
import ReactFlow, { Background, Controls } from 'react-flow-renderer';

// eslint-disable-next-line react/prop-types
function ReactFlowBox({
  elements, onConnect, onElementsRemove, onLoad, onDrop, onDragOver, wrapperRef, nodeTypes,
}) {
  const onNodeDragStart = (event) => {
    event.stopPropagation();
  };

  return (
    <Box w="100%" h="100%" borderWidth="1px" borderRadius="lg" ref={wrapperRef}>
      <ReactFlow
        elements={elements}
        onConnect={onConnect}
        onElementsRemove={onElementsRemove}
        onLoad={onLoad}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDragStart}
        onNodeDragStop={onNodeDragStart}
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
