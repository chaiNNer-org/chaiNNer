/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Box, Center, Heading, HStack, Tooltip, useColorModeValue, VStack,
} from '@chakra-ui/react';
import React, {
  memo,
} from 'react';
import { IconFactory } from '../CustomIcons.jsx';

const IteratorNodeHeader = ({
  type, width, icon, accentColor, selected, percentComplete,
}) => (
  <VStack spacing={0} w={width || 'full'}>
    <Center
      w={width || 'full'}
      h="auto"
      borderBottomColor={accentColor}
      borderBottomWidth={percentComplete !== undefined ? '0px' : '4px'}
      verticalAlign="middle"
      borderStyle="default"
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
    {percentComplete !== undefined && (
      <Tooltip
        label={`${Number(percentComplete * 100).toFixed(1)}%`}
        borderRadius={8}
        py={1}
        px={2}
      >
        <Box
          bgColor="gray.500"
          w="full"
          h={1}
        >
          <Box
            w={`${percentComplete * 100}%`}
            bgColor={accentColor}
            h="full"
            transition="all 0.15s ease-in-out"
          />
        </Box>
      </Tooltip>
    )}
  </VStack>
);

export default memo(IteratorNodeHeader);
