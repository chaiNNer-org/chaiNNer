/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Center, Heading, HStack,
} from '@chakra-ui/react';
import React, {
  memo,
} from 'react';
import getAccentColor from '../../helpers/getNodeAccentColors.js';
import { IconFactory } from '../CustomIcons.jsx';

const NodeHeader = ({ category, type, width }) => (
  <Center
    w={width || 'full'}
    h="auto"
    borderBottomColor={getAccentColor(category)}
    borderBottomWidth="4px"
  >
    <HStack
      pl={6}
      pr={6}
      pb={2}
    >
      <Center>
        {IconFactory(category)}
      </Center>
      <Center>
        <Heading as="h5" size="sm" m={0} p={0} fontWeight={700}>
          {type.toUpperCase()}
        </Heading>
      </Center>
    </HStack>
  </Center>
);

export default memo(NodeHeader);
