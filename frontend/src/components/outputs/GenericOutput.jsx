/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Text,
} from '@chakra-ui/react';
import React from 'react';
import OutputContainer from './OutputContainer.jsx';

function GenericOutput({ label }) {
  return (
    <OutputContainer>
      <Text w="full" textAlign="right" marginInlineEnd="0.5rem">
        {label}
      </Text>
    </OutputContainer>
  );
}

export default GenericOutput;
