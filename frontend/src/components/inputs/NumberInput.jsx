/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper,
} from '@chakra-ui/react';
import React, { memo, useContext } from 'react';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import InputContainer from './InputContainer.jsx';

const NumericalInput = memo(({
  label, data, index, def, min, max, precision, step,
}) => {
  const { id } = data;
  const { useInputData, useNodeLock } = useContext(GlobalContext);
  const [input, setInput] = useInputData(id, index);
  const [isLocked] = useNodeLock(id);

  const handleChange = (number) => {
    if (data?.inputs[index]?.type.includes('odd')) {
      // Make the number odd if need be
      setInput(Number(number) + (1 - (Number(number) % 2)));
    } else {
      setInput(number);
    }
  };

  return (
    <InputContainer id={id} index={index} label={label}>
      <NumberInput
        default={def}
        min={min}
        max={max}
        precision={precision}
        placeholder={label}
        value={input}
        onChange={handleChange}
        draggable={false}
        className="nodrag"
        disabled={isLocked}
        step={step ?? 1}
      >
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>

    </InputContainer>
  );
});

export default NumericalInput;
