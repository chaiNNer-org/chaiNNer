import {
  HStack,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Text,
  Tooltip,
} from '@chakra-ui/react';
import { memo, useContext, useEffect, useState } from 'react';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState.jsx';

const SliderInput = memo(({ index, def, min, max, id, accentColor, isLocked }) => {
  const { useInputData } = useContext(GlobalContext);
  const [input, setInput] = useInputData(id, index);
  const [sliderValue, setSliderValue] = useState(input ?? def);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    setSliderValue(input);
  }, [input]);

  return (
    <HStack>
      <Text fontSize="xs">{min}</Text>
      <Slider
        defaultValue={def}
        focusThumbOnChange={false}
        isDisabled={isLocked}
        max={max}
        min={min}
        step={1}
        value={sliderValue ?? def}
        onChange={(v) => setSliderValue(v)}
        onChangeEnd={(v) => {
          setInput(v);
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <SliderTrack>
          <SliderFilledTrack bg={accentColor} />
        </SliderTrack>
        <Tooltip
          hasArrow
          bg={accentColor}
          borderRadius={8}
          color="white"
          isOpen={showTooltip}
          label={`${sliderValue}`}
          placement="top"
          px={2}
          py={1}
        >
          <SliderThumb />
        </Tooltip>
      </Slider>
      <Text fontSize="xs">{max}</Text>
      <NumberInput
        className="nodrag"
        default={def}
        disabled={isLocked}
        // precision={precision}
        draggable={false}
        max={max ?? Infinity}
        min={min ?? -Infinity}
        placeholder={def}
        size="xs"
        step={1}
        value={sliderValue ?? def}
        onChange={(v) => {
          setInput(Math.min(Math.max(v, min), max));
        }}
      >
        <NumberInputField
          m={0}
          p={1}
          w="3.1rem"
        />
        <NumberInputStepper w={4}>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
    </HStack>
  );
});
export default SliderInput;
