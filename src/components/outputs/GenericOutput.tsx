import { Text } from '@chakra-ui/react';
import { memo } from 'react';
import OutputContainer from './OutputContainer';

interface GenericOutputProps {
  id: string;
  label: string;
  index: number;
}

const GenericOutput = memo(({ label, id, index }: GenericOutputProps) => (
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
