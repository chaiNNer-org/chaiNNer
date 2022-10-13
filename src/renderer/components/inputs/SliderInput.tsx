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
import { useContextSelector } from 'use-context-selector';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { getTypeAccentColors } from '../../helpers/getTypeAccentColors';
import { AdvancedNumberInput } from './elements/AdvanceNumberInput';
import { InputProps } from './props';

interface SliderInputProps extends InputProps {
    min: number;
    max: number;
    precision: number;
    controlsStep: number;
    sliderStep: number;
    def: number;
    unit?: string | null;
    ends: [string | null, string | null];
    noteExpression?: string;
    hideTrailingZeros: boolean;
    gradient?: string[];
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
        id,
        inputId,
        useInputData,
        def,
        min,
        max,
        precision,
        controlsStep,
        sliderStep,
        unit,
        ends,
        noteExpression,
        hideTrailingZeros,
        isLocked,
        definitionType,
        gradient,
    }: SliderInputProps) => {
        const isInputLocked = useContextSelector(GlobalVolatileContext, (c) => c.isNodeInputLocked)(
            id,
            inputId
        );

        const [input, setInput] = useInputData<number>(inputId);
        const [inputString, setInputString] = useState(String(input));
        const [sliderValue, setSliderValue] = useState(input ?? def);
        const [showTooltip, setShowTooltip] = useState(false);

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

        const [typeAccentColor] = getTypeAccentColors(definitionType);

        const typeNumber = useContextSelector(GlobalVolatileContext, (c) => {
            const type = c.typeState.functions.get(id)?.inputs.get(inputId);
            return type && type.underlying === 'number' && type.type === 'literal'
                ? type.value
                : undefined;
        });
        const typeNumberString = typeNumber !== undefined ? precisionOutput(typeNumber) : '';

        const displaySliderValue: number = isInputLocked ? typeNumber ?? def : sliderValue;
        const expr = noteExpression
            ? tryEvaluate(noteExpression, {
                  min,
                  max,
                  value: displaySliderValue,
              })
            : undefined;
        const filled = !expr;

        return (
            <VStack w="full">
                <HStack w="full">
                    {ends[0] && <Text fontSize="xs">{ends[0]}</Text>}
                    <Slider
                        defaultValue={def}
                        focusThumbOnChange={false}
                        isDisabled={isLocked || isInputLocked}
                        max={max}
                        min={min}
                        step={sliderStep}
                        value={displaySliderValue}
                        onChange={onSliderChange}
                        onChangeEnd={setInput}
                        onDoubleClick={() => onSliderChange(def)}
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                    >
                        <SliderTrack
                            bgGradient={gradient ? `linear(to-r, ${gradient.join(', ')})` : 'none'}
                        >
                            {filled && !gradient ? (
                                <SliderFilledTrack bg={typeAccentColor} />
                            ) : (
                                <SliderTrack />
                            )}
                        </SliderTrack>
                        <Tooltip
                            hasArrow
                            bg={typeAccentColor}
                            borderRadius={8}
                            color="white"
                            isOpen={showTooltip}
                            label={`${precisionOutput(displaySliderValue)}${unit ?? ''}`}
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
                        inputString={isInputLocked ? typeNumberString : inputString}
                        isDisabled={isLocked || isInputLocked}
                        max={max}
                        min={min}
                        precision={precision}
                        setInput={setInput}
                        setInputString={onNumberInputChange}
                        unit={unit}
                    />
                </HStack>
                {expr && <Text fontSize="xs">{expr}</Text>}
            </VStack>
        );
    }
);
