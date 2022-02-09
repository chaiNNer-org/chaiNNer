/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
  HStack, Slider, SliderFilledTrack, SliderThumb, SliderTrack, Text, Tooltip,
} from '@chakra-ui/react';
import React, {
  memo, useContext, useEffect, useState,
} from 'react';
import { GlobalContext } from '../../helpers/GlobalNodeState.jsx';

const SliderInput = memo(({
  label, index, def, min, max, id, accentColor,
}) => {
  const { useInputData, useNodeLock } = useContext(GlobalContext);
  const [input, setInput] = useInputData(id, index);
  const [sliderValue, setSliderValue] = useState(input ?? def);
  const [isLocked] = useNodeLock(id);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    setSliderValue(input);
  }, [input]);

  return (
    <HStack>
      <Text
        fontSize="xs"
      >
        {min}
      </Text>
      <Slider
        defaultValue={def}
        min={min}
        max={max}
        step={1}
        value={sliderValue ?? def}
        onChange={(v) => setSliderValue(v)}
        onChangeEnd={(v) => { setInput(v); }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        isDisabled={isLocked}
      >
        <SliderTrack>
          <SliderFilledTrack bg={accentColor} />
        </SliderTrack>
        <Tooltip
          hasArrow
          bg={accentColor}
          color="white"
          placement="top"
          isOpen={showTooltip}
          label={`${sliderValue}%`}
        >
          <SliderThumb />
        </Tooltip>
      </Slider>
      <Text
        fontSize="xs"
      >
        {max}
      </Text>
    </HStack>
  );
});
export default SliderInput;
