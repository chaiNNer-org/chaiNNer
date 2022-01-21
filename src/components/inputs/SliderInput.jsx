/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  Slider, SliderFilledTrack, SliderThumb, SliderTrack,
} from '@chakra-ui/react';
import React, {
  memo, useContext, useEffect, useState,
} from 'react';
import { useDebouncedCallback } from 'use-debounce';
import getAccentColor from '../../helpers/getNodeAccentColors.js';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';
import InputContainer from './InputContainer.jsx';

const SliderInput = memo(({
  label, data, index, def, min, max,
}) => {
  const { id } = data;
  const { useInputData, useNodeLock } = useContext(GlobalContext);
  const [input, setInput] = useInputData(id, index);
  const [sliderValue, setSliderValue] = useState(input ?? def);
  const [isLocked] = useNodeLock(id);

  const handleChange = useDebouncedCallback(
    (number) => {
      setInput(number);
    },
    500,
  );

  useEffect(() => {
    setSliderValue(input);
  }, [input]);

  return (
    <InputContainer id={id} index={index} label={label}>
      <Slider
        defaultValue={def}
        min={min}
        max={max}
        step={1}
        onChange={(v) => { handleChange(v); setSliderValue(v); }}
        value={sliderValue ?? def}
        isDisabled={isLocked}
      >
        <SliderTrack>
          <SliderFilledTrack bg={getAccentColor(data.category)} />
        </SliderTrack>
        <SliderThumb />
      </Slider>

    </InputContainer>
  );
});
export default SliderInput;
