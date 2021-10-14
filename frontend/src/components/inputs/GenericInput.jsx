/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Text } from '@chakra-ui/react';
import React from 'react';
import InputContainer from './InputContainer.jsx';

function GenericInput({
  label, hasHandle = true, data, index,
}) {
  const { id } = data;
  return (
    <InputContainer hasHandle={hasHandle} id={id} index={index}>
      <Text w="full">
        {label}
      </Text>
    </InputContainer>
  );
}

export default GenericInput;
