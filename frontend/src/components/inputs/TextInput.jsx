/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Input } from '@chakra-ui/react';
import React, { memo, useContext } from 'react';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import InputContainer from './InputContainer.jsx';

const TextInput = memo(({ label, data, index }) => {
  const { id } = data;
  const { useNodeData } = useContext(GlobalContext);
  const [nodeData, setNodeData] = useNodeData(id);

  const handleChange = (event) => {
    const text = event.target.value;
    const inputData = nodeData?.inputData ?? {};
    const sharedData = nodeData?.sharedData ?? {};
    inputData[index] = text;
    sharedData.text = text;
    setNodeData({ inputData, sharedData });
  };

  return (
    <InputContainer id={id} index={index} label={label}>
      <Input
        placeholder={label}
        value={nodeData?.sharedData?.text}
        onChange={handleChange}
        // bg={useColorModeValue('gray.500', 'gray.200')}
        // textColor={useColorModeValue('gray.200', 'gray.700')}
        // borderColor={useColorModeValue('gray.200', 'gray.700')}
        // _placeholder={{ color: useColorModeValue('gray.200', 'gray.700') }}
        draggable={false}
        // cursor="pointer"
        className="nodrag"
      />
    </InputContainer>
  );
});

export default TextInput;
