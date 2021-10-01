import {
  Box,
} from '@chakra-ui/react';
import React from 'react';
import ReactFlow, { Background, Controls } from 'react-flow-renderer';

// eslint-disable-next-line react/prop-types
function ReactFlowBox({ elements }) {
  return (
    <Box w="100%" h="100%" borderWidth="1px" borderRadius="lg">
      <ReactFlow elements={elements} style={{ zIndex: 0 }}>
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
