
import { Textarea } from '@chakra-ui/react';
import { memo, useContext, useEffect } from 'react';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState.jsx';

const TextAreaInput = memo(({
  label, id, index, isLocked, resizable,
}) => {
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
      placeholder={label}
      resize={resizable ? 'both' : 'none'}
      draggable={false}
      className="nodrag"
      disabled={isLocked}
      onChange={handleChange}
      value={input ?? ''}
      minW={240}
    />
  );
});

export default TextAreaInput;
