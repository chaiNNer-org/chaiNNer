import { Text } from '@chakra-ui/react';
import { memo } from 'react';
import OutputContainer from './OutputContainer.jsx';

const GenericOutput = memo(({ label, id, index }) => (
  <OutputContainer
    hasHandle
    id={id}
    index={index}
  >
    <Text
      marginInlineEnd="0.5rem"
      mb={-1}
      mt={-1}
      textAlign="right"
      w="full"
    >
      {label}
    </Text>
  </OutputContainer>
));

export default GenericOutput;
