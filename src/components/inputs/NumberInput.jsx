import {
  NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper,
} from '@chakra-ui/react';
import { memo, useContext } from 'react';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState.jsx';

const NumericalInput = memo(({
  label, id, index, def, min, max, precision, step, type, isLocked,
}) => {
  const { useInputData, useNodeLock } = useContext(GlobalContext);
  const [input, setInput] = useInputData(id, index);
  const [, , isInputLocked] = useNodeLock(id, index);

  const handleChange = (numberAsString, numberAsNumber) => {
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
      default={def}
      disabled={isLocked || isInputLocked}
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
});

export default NumericalInput;
