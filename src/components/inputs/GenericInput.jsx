/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Box, Text } from '@chakra-ui/react';
import React, { memo } from 'react';

const GenericInput = memo(({
  label, hasHandle = true, id, index,
}) => (
  // These both need to have -1 margins to thin it out... I don't know why
  <Box mt={-1} mb={-1}>
    <Text w="full" textAlign="left" mt={-1} mb={-1}>
      {label}
    </Text>
  </Box>
));

export default GenericInput;
