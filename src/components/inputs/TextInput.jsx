/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Input } from '@chakra-ui/react';
import React, { memo, useContext, useEffect } from 'react';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';

const TextInput = memo(({
  label, id, index, isLocked,
}) => {
  const { useInputData } = useContext(GlobalContext);
  const [input, setInput] = useInputData(id, index);

  useEffect(() => {
    setInput('');
  }, []);

  const handleChange = (event) => {
    const text = event.target.value;
    setInput(text);
  };

  return (
    <Input
      placeholder={label}
      value={input ?? ''}
      onChange={handleChange}
      draggable={false}
      className="nodrag"
      disabled={isLocked}
    />
  );
});

export default TextInput;
