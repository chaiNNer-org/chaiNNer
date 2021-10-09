/* eslint-disable react/prop-types */
import {
  Box, HStack, useColorModeValue,
} from '@chakra-ui/react';
import React from 'react';
import { Handle } from 'react-flow-renderer';

function OutputContainer({ children, hasHandle = true }) {
  let contents = children;
  if (hasHandle) {
    contents = (
      <HStack h="full">
        {children}
        <div
          style={{ position: 'absolute', right: '-4px', width: 0 }}
        >
          <Handle
            type="source"
            position="right"
            style={{
              background: '#171923', width: '15px', height: '15px', borderWidth: '1px',
            }}
            onConnect={(params) => console.log('handle onConnect', params)}
            isConnectable
          />
        </div>
      </HStack>
    );
  }

  return (
    <>
      <Box
        p={2}
        bg={useColorModeValue('gray.200', 'gray.600')}
        w="full"
      >
        {contents}
      </Box>
    </>
  );
}

export default OutputContainer;
