import {
  Box, Center, Heading, HStack, Tooltip, useColorModeValue, VStack,
} from '@chakra-ui/react';
import {
  memo,
} from 'react';
import { IconFactory } from '../CustomIcons.jsx';

const IteratorNodeHeader = ({
  type, width, icon, accentColor, selected, percentComplete,
}) => (
  <VStack
    spacing={0}
    w={width || 'full'}
  >
    <Center
      borderBottomColor={accentColor}
      borderBottomWidth={percentComplete !== undefined ? '0px' : '4px'}
      borderStyle="default"
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
    {percentComplete !== undefined && (
      <Tooltip
        borderRadius={8}
        label={`${Number(percentComplete * 100).toFixed(1)}%`}
        px={2}
        py={1}
      >
        <Box
          bgColor="gray.500"
          h={1}
          w="full"
        >
          <Box
            bgColor={accentColor}
            h="full"
            transition="all 0.15s ease-in-out"
            w={`${percentComplete * 100}%`}
          />
        </Box>
      </Tooltip>
    )}
  </VStack>
);

export default memo(IteratorNodeHeader);
