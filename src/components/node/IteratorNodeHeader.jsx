/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Center, Heading, HStack, useColorModeValue,
} from '@chakra-ui/react';
import React, {
  memo,
} from 'react';
import { IconFactory } from '../CustomIcons.jsx';

const IteratorNodeHeader = ({
  category, type, width, icon, accentColor, selected,
}) => (
  <Center
    w={width || 'full'}
    h="auto"
    borderBottomColor={accentColor}
    borderBottomWidth="4px"
    verticalAlign="middle"
    borderStyle="double"
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

export default memo(IteratorNodeHeader);
