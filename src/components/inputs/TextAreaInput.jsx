import { Textarea } from '@chakra-ui/react';
import { memo, useContext, useEffect } from 'react';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState';

const TextAreaInput = memo(({ label, id, index, isLocked, resizable }) => {
  const { useInputData } = useContext(GlobalContext);
  const [input, setInput] = useInputData(id, index);

  useEffect(() => {
    if (!input) {
      setInput('');
    }
  }, []);

  const handleChange = (event) => {
    const text = event.target.value;
    setInput(text);
  };

  return (
    <Textarea
      className="nodrag"
      disabled={isLocked}
      draggable={false}
      minW={240}
      placeholder={label}
      resize={resizable ? 'both' : 'none'}
      value={input ?? ''}
      onChange={handleChange}
    />
  );
});

export default TextAreaInput;
