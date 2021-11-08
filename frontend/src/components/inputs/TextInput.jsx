/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Input } from '@chakra-ui/react';
import React, { memo, useContext } from 'react';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import InputContainer from './InputContainer.jsx';

const TextInput = memo(({ label, data, index }) => {
  const { id } = data;
  const { useInputData } = useContext(GlobalContext);
  const [input, setInput] = useInputData(id, index);

  const handleChange = (event) => {
    const text = event.target.value;
    setInput(text);
  };

  return (
    <InputContainer id={id} index={index} label={label}>
      <Input
        placeholder={label}
        value={input}
        onChange={handleChange}
        draggable={false}
        className="nodrag"
      />
    </InputContainer>
  );
});

export default TextInput;
