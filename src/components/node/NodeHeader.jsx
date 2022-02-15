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
  >
    <HStack
      pl={6}
      pr={6}
      pb={2}
    >
      <Center h={4} w={4} alignContent="center" alignItems="center">
        {IconFactory(icon, useColorModeValue('gray.600', 'gray.400'))}
      </Center>
      <Center>
        <Heading as="h5" size="sm" m={0} p={0} fontWeight={700} textAlign="center">
          {type.toUpperCase()}
        </Heading>
      </Center>
    </HStack>
  </Center>
);

export default memo(NodeHeader);
