import { isNumericLiteral } from '@chainner/navi';
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
import { getTypeAccentColors } from '../../helpers/getTypeAccentColors';
import { AdvancedNumberInput } from './elements/AdvanceNumberInput';
import { InputProps } from './props';

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
        value,
        setValue,
        input,
        isLocked,
        definitionType,
        useInputConnected,
        useInputType,
    }: InputProps<'slider', number>) => {
        const {
            def,
            min,
            max,
            precision,
            controlsStep,
            sliderStep,
            unit,
            hideTrailingZeros,
            noteExpression,
            ends,
            gradient,
        } = input;

        const [inputString, setInputString] = useState(String(value));
        const [sliderValue, setSliderValue] = useState(value ?? def);
        const [showTooltip, setShowTooltip] = useState(false);

        const precisionOutput = (val: number) =>
            hideTrailingZeros ? String(val) : val.toFixed(precision);

        useEffect(() => {
            setSliderValue(value ?? def);
            if (!Number.isNaN(value)) {
                setInputString(precisionOutput(value ?? def));
            }
        }, [value]);

        const onSliderChange = (sliderInput: number) => {
            setInputString(precisionOutput(sliderInput));
            setSliderValue(sliderInput);
        };

        const onNumberInputChange = (numberAsString: string) => {
            setInputString(numberAsString);
            setSliderValue(Number(numberAsString));
        };

        const [typeAccentColor] = getTypeAccentColors(definitionType);

        const isInputConnected = useInputConnected();
        const inputType = useInputType();
        const typeNumber = isNumericLiteral(inputType) ? inputType.value : undefined;
        const typeNumberString = typeNumber !== undefined ? precisionOutput(typeNumber) : '';

        const displaySliderValue: number = isInputConnected ? typeNumber ?? def : sliderValue;
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
                        isDisabled={isLocked || isInputConnected}
                        max={max}
                        min={min}
                        step={sliderStep}
                        value={displaySliderValue}
                        onChange={onSliderChange}
                        onChangeEnd={setValue}
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
                        inputString={isInputConnected ? typeNumberString : inputString}
                        isDisabled={isLocked || isInputConnected}
                        max={max}
                        min={min}
                        precision={precision}
                        setInput={setValue}
                        setInputString={onNumberInputChange}
                        unit={unit}
                    />
                </HStack>
                {expr && <Text fontSize="xs">{expr}</Text>}
            </VStack>
        );
    }
);
