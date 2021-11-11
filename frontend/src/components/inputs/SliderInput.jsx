/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Slider, SliderFilledTrack, SliderThumb, SliderTrack,
} from '@chakra-ui/react';
import React, { memo, useContext } from 'react';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import InputContainer from './InputContainer.jsx';

const SliderInput = memo(({
  label, data, index, def, min, max,
}) => {
  const { id } = data;
  const { useInputData, useNodeLock } = useContext(GlobalContext);
  const [input, setInput] = useInputData(id, index);
  const [isLocked] = useNodeLock(id);

  const handleChange = (number) => {
    setInput(number);
  };

  return (
    <InputContainer id={id} index={index} label={label}>
      <Slider
        defaultValue={def}
        min={min}
        max={max}
        step={1}
        onChange={handleChange}
        value={input}
        isDisabled={isLocked}
      >
        <SliderTrack>
          <SliderFilledTrack />
        </SliderTrack>
        <SliderThumb />
      </Slider>

    </InputContainer>
  );
});

export default SliderInput;
