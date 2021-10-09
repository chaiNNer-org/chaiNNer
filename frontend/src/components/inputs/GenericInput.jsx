/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Text } from '@chakra-ui/react';
import React from 'react';
import InputContainer from './InputContainer.jsx';

function GenericInput({ label, hasHandle = true }) {
  return (
    <InputContainer hasHandle={hasHandle}>
      <Text w="full">
        {label}
      </Text>
    </InputContainer>
  );
}

export default GenericInput;
