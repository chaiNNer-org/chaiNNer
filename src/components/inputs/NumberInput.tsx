import {
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
} from '@chakra-ui/react';
import { memo, useContext } from 'react';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState';

interface NumericalInputProps {
  id: string;
  index: number;
  isLocked?: boolean;
  label: string;
  type: string;
  min?: number;
  max?: number;
  precision?: number;
  step?: number;
  def?: number;
}

const NumericalInput = memo(
  ({ label, id, index, def, min, max, precision, step, type, isLocked }: NumericalInputProps) => {
    const { useInputData, useNodeLock } = useContext(GlobalContext);
    // TODO: make sure this is always a number
    const [input, setInput] = useInputData<string | number>(id, index);
    const [, , isInputLocked] = useNodeLock(id, index);

    const handleChange = (numberAsString: string, numberAsNumber: number) => {
      if (type.includes('odd')) {
        // Make the number odd if need be
        setInput(String(numberAsNumber + (1 - (numberAsNumber % 2))));
      } else {
        setInput(numberAsString);
      }
    };

    return (
      <NumberInput
        className="nodrag"
        defaultValue={def}
        isDisabled={isLocked || isInputLocked}
        draggable={false}
        max={max ?? Infinity}
        min={min ?? -Infinity}
        placeholder={label}
        precision={precision}
        step={step ?? 1}
        value={String(input)}
        onChange={handleChange}
      >
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
    );
  }
);

export default NumericalInput;
