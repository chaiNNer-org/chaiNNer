/* eslint-disable import/prefer-default-export */
import { CheckCircleIcon, WarningIcon } from '@chakra-ui/icons';
import { Center, Flex, Icon, Spacer, Tooltip, useColorModeValue } from '@chakra-ui/react';
import { memo } from 'react';

const NodeFooter = ({ isValid = false, invalidReason = '' }) => {
  const iconShade = useColorModeValue('gray.400', 'gray.800');
  const validShade = useColorModeValue('gray.900', 'gray.100');
  // const invalidShade = useColorModeValue('red.200', 'red.900');
  const invalidShade = useColorModeValue('red.400', 'red.600');
  // const iconShade = useColorModeValue('gray.400', 'gray.800');

  return (
    <Flex
      pl={2}
      pr={2}
      w="full"
    >
      <Spacer />
      <Tooltip
        hasArrow
        borderRadius={8}
        closeOnClick={false}
        gutter={24}
        label={isValid ? 'Node valid' : invalidReason}
        px={2}
        py={1}
        textAlign="center"
      >
        <Center
          className="nodrag"
          my={-1}
        >
          <Center
            bgColor={isValid ? validShade : iconShade}
            borderRadius={100}
            mr={-3.5}
            p={1.5}
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
