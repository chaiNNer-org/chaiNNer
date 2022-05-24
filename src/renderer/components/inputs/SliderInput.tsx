import {
    HStack,
    Slider,
    SliderFilledTrack,
    SliderThumb,
    SliderTrack,
    Text,
    Tooltip,
    VStack,
} from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { AdvancedNumberInput } from './elements/AdvanceNumberInput';
import { InputProps } from './props';

interface SliderInputProps extends InputProps {
    min: number;
    max: number;
    offset: number;
    step: number;
    controlsStep: number;
    def?: number;
    unit?: string | null;
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
        inputId,
        useInputData,
        def,
        min,
        max,
        offset,
        step,
        controlsStep,
        unit,
        ends,
        noteExpression,
        accentColor,
        isLocked,
    }: SliderInputProps) => {
        const [input, setInput] = useInputData<number>(inputId);
        const [inputString, setInputString] = useState(String(input));
        const [sliderValue, setSliderValue] = useState(input ?? def);
        const [showTooltip, setShowTooltip] = useState(false);

        useEffect(() => {
            setSliderValue(input);
            if (!Number.isNaN(input)) {
                setInputString(String(input));
            }
        }, [input]);

        const onSliderChange = (sliderInput: number) => {
            setInputString(String(sliderInput));
            setSliderValue(sliderInput);
        };

        const onNumberInputChange = (numberAsString: string) => {
            setInputString(numberAsString);
            setSliderValue(Number(numberAsString));
        };

        const expr = noteExpression
            ? tryEvaluate(noteExpression, {
                  min,
                  max,
                  value: sliderValue ?? def,
              })
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
                        onChange={onSliderChange}
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
                            label={`${sliderValue ?? 0}${unit ?? ''}`}
                            placement="top"
                            px={2}
                            py={1}
                        >
                            <SliderThumb />
                        </Tooltip>
                    </Slider>
                    {ends && <Text fontSize="xs">{ends[1]}</Text>}
                    <AdvancedNumberInput
                        small
                        controlsStep={controlsStep}
                        defaultValue={def}
                        inputString={inputString}
                        isDisabled={isLocked}
                        max={max}
                        min={min}
                        offset={offset}
                        setInput={setInput}
                        setInputString={onNumberInputChange}
                        step={step}
                        unit={unit}
                    />
                </HStack>
                {expr && <Text fontSize="xs">{expr}</Text>}
            </VStack>
        );
    }
);
export default SliderInput;
