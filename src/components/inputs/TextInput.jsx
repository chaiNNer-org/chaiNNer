import { Input } from '@chakra-ui/react';
import { memo, useContext, useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState';

const TextInput = memo(({ label, id, index, isLocked, maxLength }) => {
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
      className="nodrag"
      disabled={isLocked || isInputLocked}
      draggable={false}
      maxLength={maxLength}
      placeholder={label}
      value={tempText ?? ''}
      onChange={(event) => {
        setTempText(event.target.value);
        handleChange(event);
      }}
    />
  );
});

export default TextInput;
