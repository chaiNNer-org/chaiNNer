/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField, NumberInputStepper,
} from '@chakra-ui/react';
import React, { memo, useContext } from 'react';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import InputContainer from './InputContainer.jsx';

const NumericalInput = memo(({
  label, data, index, def, min, max, precision,
}) => {
  const { id } = data;
  const { useNodeData } = useContext(GlobalContext);
  const [nodeData, setNodeData] = useNodeData(id);

  const handleChange = (number) => {
    const inputData = nodeData?.inputData ?? {};
    const sharedData = nodeData?.sharedData ?? {};
    inputData[index] = number;
    setNodeData({ inputData, sharedData });
  };

  return (
    <InputContainer id={id} index={index} label={label}>
      <NumberInput
        default={def}
        min={min}
        max={max}
        precision={precision}
        placeholder={label}
        value={nodeData?.inputData[index]}
        onChange={handleChange}
        draggable={false}
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
