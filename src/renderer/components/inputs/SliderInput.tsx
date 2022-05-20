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
    VStack,
} from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { InputProps } from './props';

interface SliderInputProps extends InputProps {
    min: number;
    max: number;
    precision: number;
    step: number;
    controlsStep: number;
    def?: number;
    units?: number | null;
    accentColor: string;
    ends?: [string | number, string | number] | null;
    noteExpression?: string;
}

const tryEvaluate = (expression: string, args: Record<string, unknown>): string | undefined => {
    try {
        return String(
            // eslint-disable-next-line @typescript-eslint/no-implied-eval
            new Function(...Object.keys(args), `return ${expression};`)(...Object.values(args))
        );
    } catch (error) {
        return undefined;
    }
};

const SliderInput = memo(
    ({
        index,
        useInputData,
        def,
        min,
        max,
        precision,
        step,
        controlsStep,
        units,
        ends,
        noteExpression,
        accentColor,
        isLocked,
    }: SliderInputProps) => {
        const [input, setInput] = useInputData<number>(index);
        const [sliderValue, setSliderValue] = useState(input ?? def);
        const [showTooltip, setShowTooltip] = useState(false);

        useEffect(() => {
            setSliderValue(input);
        }, [input]);

        const expr = noteExpression
            ? tryEvaluate(noteExpression, { min, max, value: sliderValue ?? def })
            : undefined;
        const filled = !expr;

        return (
            <VStack w="full">
                <HStack w="full">
                    {ends && <Text fontSize="xs">{ends[0]}</Text>}
                    <Slider
                        defaultValue={def}
                        focusThumbOnChange={false}
                        isDisabled={isLocked}
                        max={max}
                        min={min}
                        step={step}
                        value={sliderValue ?? def}
                        onChange={setSliderValue}
                        onChangeEnd={setInput}
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                    >
                        <SliderTrack>
                            {filled ? <SliderFilledTrack bg={accentColor} /> : <SliderTrack />}
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
                    {ends && <Text fontSize="xs">{ends[1]}</Text>}
                    <NumberInput
                        className="nodrag"
                        defaultValue={def}
                        draggable={false}
                        isDisabled={isLocked}
                        max={max}
                        min={min}
                        placeholder={def !== undefined ? String(def) : undefined}
                        precision={precision}
                        size="xs"
                        step={controlsStep}
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
                    <Text
                        fontSize="xs"
                        m={0}
                        p={0}
                    >
                        {units}
                    </Text>
                </HStack>
                {expr && <Text fontSize="xs">{expr}</Text>}
            </VStack>
        );
    }
);
export default SliderInput;
