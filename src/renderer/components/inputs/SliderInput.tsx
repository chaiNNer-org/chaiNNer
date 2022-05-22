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
import { areApproximatelyEqual } from '../../../common/util';
import { getPrecision } from './NumberInput';
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
        index,
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
        const [input, setInput] = useInputData<number>(index);
        const [inputString, setInputString] = useState(String(input));
        const [sliderValue, setSliderValue] = useState(input ?? def);
        const [showTooltip, setShowTooltip] = useState(false);

        // Clamping offset because for some reason it is coming in as an e-14 float
        const clampedOffset = areApproximatelyEqual(offset, 0) ? 0 : offset;
        const precision = Math.max(getPrecision(clampedOffset), getPrecision(step));
        const addUnit = (val: string) => `${val}${unit ?? ''}`;
        const dynamicNumInputWidth =
            3 + 0.5 * precision + (unit !== null && unit !== undefined ? 1.1 : 0);

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

        const onBlur = () => {
            const valAsNumber =
                precision > 0
                    ? parseFloat(inputString !== '' ? inputString : String(def))
                    : Math.round(parseFloat(inputString !== '' ? inputString : String(def)));

            if (!Number.isNaN(valAsNumber)) {
                const roundedVal =
                    Math.round((valAsNumber - clampedOffset) / step) * step + clampedOffset;

                const clampMax = (value: number, max_val: number | undefined | null) => {
                    if (max_val !== undefined && max_val !== null) {
                        const valOrMax = Math.min(value, max_val);
                        return valOrMax;
                    }
                    return value;
                };
                const maxClamped = clampMax(roundedVal, max);

                const clampMin = (value: number, min_val: number | undefined | null) => {
                    if (min_val !== undefined && min_val !== null) {
                        const valOrMin = Math.max(value, min_val);
                        return valOrMin;
                    }
                    return value;
                };
                const minClamped = Number(clampMin(maxClamped, min).toFixed(precision));

                // Make sure the input value has been altered so onChange gets correct value if adjustment needed
                Promise.resolve()
                    .then(() => {
                        setInput(minClamped);
                        setInputString(String(minClamped));
                    }) // eslint-disable-next-line no-console
                    .catch(() => console.log('Failed to set input to minClamped.'));
            }
        };

        const expr = noteExpression
            ? tryEvaluate(noteExpression, {
                  min,
                  max,
                  precision,
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
                        size="xs"
                        step={controlsStep}
                        value={addUnit(inputString)}
                        onBlur={onBlur}
                        onChange={onNumberInputChange}
                    >
                        <NumberInputField
                            m={0}
                            p={1}
                            w={`${dynamicNumInputWidth}rem`}
                        />
                        <NumberInputStepper w={4}>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                        </NumberInputStepper>
                    </NumberInput>
                </HStack>
                {expr && <Text fontSize="xs">{expr}</Text>}
            </VStack>
        );
    }
);
export default SliderInput;
