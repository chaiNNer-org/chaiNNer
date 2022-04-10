/* eslint-disable import/extensions */
/* eslint-disable react/prop-types */
import {
    HStack, NumberDecrementStepper, NumberIncrementStepper, NumberInput, NumberInputField,
    NumberInputStepper, Slider, SliderFilledTrack, SliderThumb, SliderTrack, Text, Tooltip
} from '@chakra-ui/react';
import React, {
    memo, useContext, useEffect, useState
} from 'react';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState.jsx';

const SliderInput = memo(({
  label, index, def, min, max, id, accentColor, isLocked,
}) => {
  const { useInputData } = useContext(GlobalContext);
  const [input, setInput] = useInputData(id, index);
  const [sliderValue, setSliderValue] = useState(input ?? def);
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
        focusThumbOnChange={false}
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
          borderRadius={8}
          py={1}
          px={2}
        >
          <SliderThumb />
        </Tooltip>
      </Slider>
      <Text
        fontSize="xs"
      >
        {max}
      </Text>
      <NumberInput
        default={def}
        min={min ?? -Infinity}
        max={max ?? Infinity}
        // precision={precision}
        placeholder={def}
        value={sliderValue ?? def}
        onChange={(v) => {
          setInput(Math.min(Math.max(v, min), max));
        }}
        draggable={false}
        className="nodrag"
        disabled={isLocked}
        step={1}
        size="xs"
      >
        <NumberInputField w="3.1rem" p={1} m={0} />
        <NumberInputStepper w={4}>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
    </HStack>
  );
});
export default SliderInput;
