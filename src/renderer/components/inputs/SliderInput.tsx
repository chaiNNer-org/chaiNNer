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
import { useContext } from 'use-context-selector';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { SettingsContext } from '../../contexts/SettingsContext';
import { getTypeAccentColors } from '../../helpers/getTypeAccentColors';
import { AdvancedNumberInput, getPrecision } from './elements/AdvanceNumberInput';
import { InputProps } from './props';

interface SliderInputProps extends InputProps {
    min: number;
    max: number;
    offset: number;
    step: number;
    controlsStep: number;
    sliderStep: number;
    def: number;
    unit?: string | null;
    ends: [string | null, string | null];
    noteExpression?: string;
    hideTrailingZeros: boolean;
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

export const SliderInput = memo(
    ({
        inputId,
        useInputData,
        def,
        min,
        max,
        offset,
        step,
        controlsStep,
        sliderStep,
        unit,
        ends,
        noteExpression,
        hideTrailingZeros,
        isLocked,
        definitionType,
    }: SliderInputProps) => {
        const { typeDefinitions } = useContext(GlobalContext);
        const { useIsDarkMode } = useContext(SettingsContext);
        const [isDarkMode] = useIsDarkMode;

        const [input, setInput] = useInputData<number>(inputId);
        const [inputString, setInputString] = useState(String(input));
        const [sliderValue, setSliderValue] = useState(input ?? def);
        const [showTooltip, setShowTooltip] = useState(false);

        const precision = Math.max(getPrecision(offset), getPrecision(step));
        const precisionOutput = (val: number) =>
            hideTrailingZeros ? String(val) : val.toFixed(precision);

        useEffect(() => {
            setSliderValue(input ?? def);
            if (!Number.isNaN(input)) {
                setInputString(precisionOutput(input ?? def));
            }
        }, [input]);

        const onSliderChange = (sliderInput: number) => {
            setInputString(precisionOutput(sliderInput));
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
                  value: sliderValue,
              })
            : undefined;
        const filled = !expr;

        const [typeAccentColor] = getTypeAccentColors(definitionType, typeDefinitions, isDarkMode);

        return (
            <VStack w="full">
                <HStack w="full">
                    {ends[0] && <Text fontSize="xs">{ends[0]}</Text>}
                    <Slider
                        defaultValue={def}
                        focusThumbOnChange={false}
                        isDisabled={isLocked}
                        max={max}
                        min={min}
                        step={sliderStep}
                        value={sliderValue}
                        onChange={onSliderChange}
                        onChangeEnd={setInput}
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                    >
                        <SliderTrack>
                            {filled ? <SliderFilledTrack bg={typeAccentColor} /> : <SliderTrack />}
                        </SliderTrack>
                        <Tooltip
                            hasArrow
                            bg={typeAccentColor}
                            borderRadius={8}
                            color="white"
                            isOpen={showTooltip}
                            label={`${precisionOutput(sliderValue)}${unit ?? ''}`}
                            placement="top"
                            px={2}
                            py={1}
                        >
                            <SliderThumb />
                        </Tooltip>
                    </Slider>
                    {ends[1] && <Text fontSize="xs">{ends[1]}</Text>}
                    <AdvancedNumberInput
                        small
                        controlsStep={controlsStep}
                        defaultValue={def}
                        hideTrailingZeros={hideTrailingZeros}
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
