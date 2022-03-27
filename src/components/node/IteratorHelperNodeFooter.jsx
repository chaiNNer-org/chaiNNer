/* eslint-disable import/extensions */
/* eslint-disable import/prefer-default-export */
/* eslint-disable react/prop-types */
import {
  CheckCircleIcon, WarningIcon,
} from '@chakra-ui/icons';
import {
  Center, Flex, Icon, Spacer, Tooltip, useColorModeValue,
} from '@chakra-ui/react';
import React, {
  memo,
} from 'react';

const NodeFooter = ({
  id, isValid = false, invalidReason = '',
}) => {
  const iconShade = useColorModeValue('gray.400', 'gray.800');
  const validShade = useColorModeValue('gray.900', 'gray.100');
  // const invalidShade = useColorModeValue('red.200', 'red.900');
  const invalidShade = useColorModeValue('red.400', 'red.600');
  // const iconShade = useColorModeValue('gray.400', 'gray.800');

  return (
    <Flex w="full" pl={2} pr={2}>
      <Spacer />
      <Tooltip
        label={isValid ? 'Node valid' : invalidReason}
        closeOnClick={false}
        hasArrow
        gutter={24}
        textAlign="center"
        borderRadius={8}
        py={1}
        px={2}
      >
        <Center my={-1} className="nodrag">
          <Center
            bgColor={isValid ? validShade : iconShade}
            borderRadius={100}
            p={1.5}
            mr={-3.5}
          />
          <Icon
            as={isValid ? CheckCircleIcon : WarningIcon}
            // color={useColorModeValue('gray.400', 'gray.800')}
            color={isValid ? iconShade : invalidShade}
            cursor="default"
          />

        </Center>
      </Tooltip>
      <Spacer />
    </Flex>
  );
};

export default memo(NodeFooter);
