import {
  Box, HStack, useColorModeValue,
} from '@chakra-ui/react';
import { memo, useContext } from 'react';
import { Handle } from 'react-flow-renderer';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState.jsx';

const OutputContainer = memo(({
  children, hasHandle, index, id,
}) => {
  const { isValidConnection } = useContext(GlobalContext);

  let contents = children;
  if (hasHandle) {
    const handleColor = useColorModeValue('#EDF2F7', '#171923');
    const borderColor = useColorModeValue('#171923', '#F7FAFC');
    contents = (
      <HStack
        h="full"
        sx={{
          '.react-flow__handle-connecting': {
            background: '#E53E3E !important',
            // cursor: 'not-allowed !important',
          },
          '.react-flow__handle-valid': {
            background: '#38A169 !important',
          },
        }}
      >
        {children}
        <div
          style={{ position: 'absolute', right: '-4px', width: 0 }}
        >
          <Handle
            id={`${id}-${index}`}
            isConnectable
            isValidConnection={isValidConnection}
            onConnect={(params) => console.log('handle onConnect', params)}
            position="right"
            style={{
              width: '15px', height: '15px', borderWidth: '1px', borderColor, transition: '0.25s ease-in-out', background: handleColor,
            }}
            type="source"
          />
        </div>
      </HStack>
    );
  }

  return (
    <Box
      bg={useColorModeValue('gray.200', 'gray.600')}
      p={2}
      w="full"
    >
      {contents}
    </Box>
  );
});

export default OutputContainer;
