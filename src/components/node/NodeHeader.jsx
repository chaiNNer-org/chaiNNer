/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Center, Heading, HStack, useColorModeValue,
} from '@chakra-ui/react';
import React, {
  memo,
} from 'react';
import { IconFactory } from '../CustomIcons.jsx';

const NodeHeader = ({
  category, type, width, icon, accentColor,
}) => (
  <Center
    w={width || 'full'}
    h="auto"
    borderBottomColor={accentColor}
    borderBottomWidth="4px"
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
      <Center h="100%" w={4} alignContent="center" alignItems="center" verticalAlign="middle">
        {IconFactory(icon, useColorModeValue('gray.600', 'gray.400'))}
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
