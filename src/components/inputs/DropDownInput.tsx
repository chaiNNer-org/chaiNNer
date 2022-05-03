import { Select } from '@chakra-ui/react';
import { ChangeEvent, memo, useContext, useEffect } from 'react';
import { InputOption } from '../../common-types';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState';

interface DropDownInputProps {
  id: string;
  index: number;
  isLocked?: boolean;
  options: readonly InputOption[];
}

const DropDownInput = memo(({ options, id, index, isLocked }: DropDownInputProps) => {
  const { useInputData } = useContext(GlobalContext);
  const [selection, setSelection] = useInputData<string | number>(id, index);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
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
      value={selection}
      onChange={handleChange}
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
