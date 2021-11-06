/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Select } from '@chakra-ui/react';
import React, { memo, useContext, useState } from 'react';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import InputContainer from './InputContainer.jsx';

const DropDownInput = memo(({
  label, options, data, index,
}) => {
  const { id } = data;
  const { useNodeData } = useContext(GlobalContext);
  const [nodeData, setNodeData] = useNodeData(id);

  const [selection, setSelection] = useState('');

  const handleChange = (event) => {
    const text = event.target.value;
    setSelection(text);
    const inputData = nodeData?.inputData ?? {};
    const sharedData = nodeData?.sharedData ?? {};
    inputData[index] = text;
    sharedData.selection = text;
    setNodeData({ inputData, sharedData });
  };

  return (
    <InputContainer id={id} index={index} label={label}>
      <Select
        // placeholder={label}
        value={selection}
        onChange={handleChange}
        // bg={useColorModeValue('gray.500', 'gray.200')}
        // textColor={useColorModeValue('gray.200', 'gray.700')}
        // borderColor={useColorModeValue('gray.200', 'gray.700')}
        // _placeholder={{ color: useColorModeValue('gray.200', 'gray.700') }}
        draggable={false}
      >
        {options.map(({ option, value }) => (
          <option key={option} value={value}>{option}</option>
        ))}
      </Select>
    </InputContainer>
  );
});

export default DropDownInput;
