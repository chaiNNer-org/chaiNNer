/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper,
} from '@chakra-ui/react';
import React, { memo, useContext } from 'react';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';

const NumericalInput = memo(({
  label, id, index, def, min, max, precision, step, type,
}) => {
  const { useInputData, useNodeLock } = useContext(GlobalContext);
  const [input, setInput] = useInputData(id, index);
  const [isLocked, , isInputLocked] = useNodeLock(id, index);

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
      default={def}
      min={min ?? -Infinity}
      max={max ?? Infinity}
      precision={precision}
      placeholder={label}
      value={String(input)}
      onChange={handleChange}
      draggable={false}
      className="nodrag"
      disabled={isLocked || isInputLocked}
      step={step ?? 1}
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
