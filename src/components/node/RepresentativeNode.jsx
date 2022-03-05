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
        verticalAlign="middle"
      >
        <HStack
          pl={4}
          pr={4}
          pb={2}
          mt={-1}
          mb={-1}
          verticalAlign="middle"
          textOverflow="ellipsis"
          overflow="hidden"
        >
          <Center h={4} w={4} alignContent="center" alignItems="center" verticalAlign="middle">
            {IconFactory(icon, useColorModeValue('gray.600', 'gray.400'))}
          </Center>
          <Center
            verticalAlign="middle"
            textOverflow="ellipsis"
            overflow="hidden"
          >
            <Heading
              as="h5"
              size="sm"
              m={0}
              p={0}
              fontWeight={700}
              textAlign="center"
              whiteSpace="nowrap"
              textOverflow="ellipsis"
              overflow="hidden"
              verticalAlign="middle"
              alignContent="center"
              lineHeight="auto"
            >
              {type.toUpperCase()}
            </Heading>
          </Center>

        </HStack>
      </Box>
    </Center>
  );
};

export default memo(RepresentativeNode);
