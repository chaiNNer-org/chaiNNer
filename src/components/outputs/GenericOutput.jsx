/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Text,
} from '@chakra-ui/react';
import React, { memo } from 'react';
import OutputContainer from './OutputContainer.jsx';

const GenericOutput = memo(({ label, id, index }) => (
  <OutputContainer hasHandle id={id} index={index}>
    <Text w="full" textAlign="right" marginInlineEnd="0.5rem" mt={-1} mb={-1}>
      {label}
    </Text>
  </OutputContainer>
));

export default GenericOutput;
