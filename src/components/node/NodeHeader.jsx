
import {
  Center, Heading, HStack, useColorModeValue
} from '@chakra-ui/react';
import {
  memo
} from 'react';
import { IconFactory } from '../CustomIcons.jsx';

const NodeHeader = ({
  category, type, width, icon, accentColor, selected, parentNode,
}) => (
  <Center
    w={width || 'full'}
    h="auto"
    borderBottomColor={accentColor}
    borderBottomWidth="4px"
    borderBottomStyle={parentNode ? 'double' : 'default'}
    verticalAlign="middle"
  >
    <HStack
      pl={6}
      pr={6}
      pb={2}
      mt={-1}
      mb={-1}
      verticalAlign="middle"
    >
      <Center h={4} w={4} alignContent="center" alignItems="center" verticalAlign="middle">
        {IconFactory(icon, selected ? accentColor : useColorModeValue('gray.600', 'gray.400'))}
      </Center>
      <Center verticalAlign="middle">
        <Heading
          as="h5"
          size="sm"
          m={0}
          p={0}
          fontWeight={700}
          textAlign="center"
          verticalAlign="middle"
          alignContent="center"
          lineHeight="auto"
        >
          {type.toUpperCase()}
        </Heading>
      </Center>
    </HStack>
  </Center>
);

export default memo(NodeHeader);
