/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Text } from '@chakra-ui/react';
import React, { memo } from 'react';

const GenericInput = memo(({
  label, hasHandle = true, id, index,
}) => (
  <Text w="full">
    {label}
  </Text>
));

export default GenericInput;
