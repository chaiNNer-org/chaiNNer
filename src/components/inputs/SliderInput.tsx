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
import { memo, useEffect, useState } from 'react';
import { InputProps } from './props';

interface SliderInputProps extends InputProps {
    min: number;
    max: number;
    def?: number;
    accentColor: string;
}

const SliderInput = memo(
    ({ index, useInputData, def, min, max, accentColor, isLocked }: SliderInputProps) => {
        const [input, setInput] = useInputData<number>(index);
        const [sliderValue, setSliderValue] = useState(input ?? def);
        const [showTooltip, setShowTooltip] = useState(false);

        useEffect(() => {
            setSliderValue(input);
        }, [input]);

        return (
            <HStack w="full">
                <Text fontSize="xs">{min}</Text>
                <Slider
                    defaultValue={def}
                    focusThumbOnChange={false}
                    isDisabled={isLocked}
                    max={max}
                    min={min}
                    step={1}
                    value={sliderValue ?? def}
                    onChange={setSliderValue}
                    onChangeEnd={setInput}
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
                        label={sliderValue}
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
                    defaultValue={def}
                    draggable={false}
                    // precision={precision}
                    isDisabled={isLocked}
                    max={max}
                    min={min}
                    placeholder={def !== undefined ? String(def) : undefined}
                    size="xs"
                    step={1}
                    value={sliderValue ?? def}
                    onChange={(_, v) => {
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
    }
);
export default SliderInput;
