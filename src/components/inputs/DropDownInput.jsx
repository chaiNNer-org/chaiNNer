import { Select } from '@chakra-ui/react';
import { memo, useContext, useEffect } from 'react';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState.jsx';

const DropDownInput = memo(({
  options, id, index, isLocked,
}) => {
  const { useInputData } = useContext(GlobalContext);
  const [selection, setSelection] = useInputData(id, index);

  const handleChange = (event) => {
    const { value } = event.target;
    setSelection(value);
  };

  useEffect(() => {
    if (selection === undefined || selection === null) {
      setSelection(options[0].value);
    }
  }, []);

  return (
    <Select
      className="nodrag"
      disabled={isLocked}
      draggable={false}
      onChange={handleChange}
      value={selection}
    >
      {options.map(({ option, value }) => (
        <option
          key={option}
          value={value}
        >
          {option}
        </option>
      ))}
    </Select>
  );
});

export default DropDownInput;
