/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Box, HStack, Text, useColorModeValue,
} from '@chakra-ui/react';
import React, { memo, useContext } from 'react';
import { Handle } from 'react-flow-renderer';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import './flow.css';

const InputContainer = memo(({
  children, hasHandle, id, index, label,
}) => {
  const { isValidConnection } = useContext(GlobalContext);

  let contents = children;
  if (hasHandle) {
    const handleColor = useColorModeValue('#EDF2F7', '#171923');
    const borderColor = useColorModeValue('#171923', '#F7FAFC');
    contents = (
      <HStack h="full">
        <div
          style={{ position: 'absolute', left: '-4px', width: 0 }}
        >
          <Handle
            type="target"
            id={`${id}-${index}`}
            position="left"
            style={{
              background: handleColor, width: '15px', height: '15px', borderWidth: '1px', borderColor,
            }}
            onConnect={(params) => console.log('handle onConnect', params)}
            isConnectable
            isValidConnection={isValidConnection}
          />
        </div>
        {children}
      </HStack>
    );
  }

  return (
    <Box
      p={2}
      bg={useColorModeValue('gray.100', 'gray.600')}
      w="full"
    >
      <Text textAlign="center" fontSize="xs" p={1} pt={-1} mt={-1} display={label ? 'block' : 'none'}>
        {label}
      </Text>
      {contents}
    </Box>
  );
});

export default InputContainer;
