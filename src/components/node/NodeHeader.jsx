import { Center, Heading, HStack, useColorModeValue } from '@chakra-ui/react';
import { memo } from 'react';
import { IconFactory } from '../CustomIcons';

const NodeHeader = ({ type, width, icon, accentColor, selected, parentNode }) => (
  <Center
    borderBottomColor={accentColor}
    borderBottomStyle={parentNode ? 'double' : 'default'}
    borderBottomWidth="4px"
    h="auto"
    verticalAlign="middle"
    w={width || 'full'}
  >
    <HStack
      mb={-1}
      mt={-1}
      pb={2}
      pl={6}
      pr={6}
      verticalAlign="middle"
    >
      <Center
        alignContent="center"
        alignItems="center"
        h={4}
        verticalAlign="middle"
        w={4}
      >
        {IconFactory(icon, selected ? accentColor : useColorModeValue('gray.600', 'gray.400'))}
      </Center>
      <Center verticalAlign="middle">
        <Heading
          alignContent="center"
          as="h5"
          fontWeight={700}
          lineHeight="auto"
          m={0}
          p={0}
          size="sm"
          textAlign="center"
          verticalAlign="middle"
        >
          {type.toUpperCase()}
        </Heading>
      </Center>
    </HStack>
  </Center>
);

export default memo(NodeHeader);
