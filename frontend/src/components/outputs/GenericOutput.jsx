/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Text,
} from '@chakra-ui/react';
import React from 'react';
import OutputContainer from './OutputContainer.jsx';

function GenericOutput({ label, data, index }) {
  const { id } = data;
  return (
    <OutputContainer hasHandle id={id} index={index}>
      <Text w="full" textAlign="right" marginInlineEnd="0.5rem">
        {label}
      </Text>
    </OutputContainer>
  );
}

export default GenericOutput;
