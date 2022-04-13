import {
  Box, Center, Heading, HStack, useColorModeValue,
} from '@chakra-ui/react';
import {
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
      borderColor={borderColor}
      borderRadius="lg"
      borderWidth="0.5px"
      boxShadow="lg"
      py={2}
      transition="0.15s ease-in-out"
      w="full"
      // opacity="0.95"
    >
      <Box
        borderBottomColor={accentColor}
        borderBottomWidth="4px"
        borderStyle={subcategory === 'Iteration' ? 'double' : 'default'}
        h="auto"
        verticalAlign="middle"
        w="full"
      >
        <HStack
          mb={-1}
          mt={-1}
          overflow="hidden"
          pb={2}
          pl={4}
          pr={4}
          textOverflow="ellipsis"
          verticalAlign="middle"
        >
          <Center
            alignContent="center"
            alignItems="center"
            h={4}
            verticalAlign="middle"
            w={4}
          >
            {IconFactory(icon, useColorModeValue('gray.600', 'gray.400'))}
          </Center>
          <Center
            overflow="hidden"
            textOverflow="ellipsis"
            verticalAlign="middle"
          >
            <Heading
              alignContent="center"
              as="h5"
              fontWeight={700}
              lineHeight="auto"
              m={0}
              overflow="hidden"
              p={0}
              size="sm"
              textAlign="center"
              textOverflow="ellipsis"
              verticalAlign="middle"
              whiteSpace="nowrap"
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
