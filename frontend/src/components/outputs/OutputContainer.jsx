/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Box, HStack, useColorModeValue,
} from '@chakra-ui/react';
import React, { memo, useContext } from 'react';
import { Handle } from 'react-flow-renderer';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';

const OutputContainer = memo(({
  children, hasHandle, index, id,
}) => {
  const { isValidConnection } = useContext(GlobalContext);

  let contents = children;
  if (hasHandle) {
    const handleColor = useColorModeValue('#EDF2F7', '#171923');
    const borderColor = useColorModeValue('#171923', '#F7FAFC');
    contents = (
      <HStack h="full">
        {children}
        <div
          style={{ position: 'absolute', right: '-4px', width: 0 }}
        >
          <Handle
            type="source"
            position="right"
            id={`${id}-${index}`}
            style={{
              background: handleColor, width: '15px', height: '15px', borderWidth: '1px', borderColor,
            }}
            onConnect={(params) => console.log('handle onConnect', params)}
            isConnectable
            isValidConnection={isValidConnection}
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
});

export default OutputContainer;
