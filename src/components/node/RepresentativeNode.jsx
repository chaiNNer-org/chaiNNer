/* eslint-disable react/prop-types */
/* eslint-disable import/extensions */
import {
  Box, Center, Heading, HStack, useColorModeValue,
} from '@chakra-ui/react';
import React, {
  memo, useMemo,
} from 'react';
import getAccentColor from '../../helpers/getNodeAccentColors.js';
import { IconFactory } from '../CustomIcons.jsx';

const RepresentativeNode = (
  {
    category, subcategory, type, icon,
  },
) => {
  console.log('🚀 ~ file: RepresentativeNode.jsx ~ line 17 ~ subcategory', subcategory);
  const borderColor = useColorModeValue('gray.400', 'gray.600');
  const accentColor = useMemo(
    () => (getAccentColor(category, subcategory)), [category, subcategory],
  );

  return (
    <Center
      bg={useColorModeValue('gray.300', 'gray.700')}
      borderWidth="0.5px"
      borderColor={borderColor}
      borderRadius="lg"
      py={2}
      boxShadow="lg"
      transition="0.15s ease-in-out"
      w="full"
      // opacity="0.95"
    >
      <Box
        w="full"
        h="auto"
        borderBottomColor={accentColor}
        borderBottomWidth="4px"
      >
        <HStack
          pl={4}
          pr={4}
          pb={2}
        >
          <Center h={4} w={4} alignContent="center" alignItems="center">
            {IconFactory(icon, useColorModeValue('gray.600', 'gray.400'))}
          </Center>
          <Heading as="h5" size="sm" m={0} p={0} fontWeight={700} textAlign="center" whiteSpace="nowrap" textOverflow="ellipsis" overflow="hidden">
            {type.toUpperCase()}
          </Heading>
        </HStack>
      </Box>
    </Center>
  );
};

export default memo(RepresentativeNode);
