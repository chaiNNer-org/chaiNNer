/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import { Input } from '@chakra-ui/react';
import React, {
  memo, useContext, useEffect, useState,
} from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';

const TextInput = memo(({
  label, id, index, isLocked, maxLength,
}) => {
  const { useInputData, useNodeLock } = useContext(GlobalContext);
  const [input, setInput] = useInputData(id, index);
  const [tempText, setTempText] = useState('');
  const [, , isInputLocked] = useNodeLock(id, index);

  useEffect(() => {
    if (!input) {
      setInput('');
    } else {
      setTempText(input);
    }
  }, []);

  const handleChange = useDebouncedCallback((event) => {
    let text = event.target.value;
    text = maxLength ? text.slice(0, maxLength) : text;
    setInput(text);
  }, 500);

  return (
    <Input
      placeholder={label}
      value={tempText ?? ''}
      onChange={(event) => {
        setTempText(event.target.value);
        handleChange(event);
      }}
      draggable={false}
      className="nodrag"
      disabled={isLocked || isInputLocked}
      maxLength={maxLength}
    />
  );
});

export default TextInput;
