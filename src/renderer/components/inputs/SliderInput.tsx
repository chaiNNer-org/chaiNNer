import { isNumericLiteral } from '@chainner/navi';
import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Input, OfKind } from '../../../common/common-types';
import { assertNever } from '../../../common/util';
import { AdvancedNumberInput } from './elements/AdvanceNumberInput';
import { CustomSlider, LINEAR_SCALE, LogScale, Scale, SliderStyle } from './elements/StyledSlider';
import { WithLabel } from './InputContainer';
import { InputProps } from './props';

const parseScale = (
    input: Pick<OfKind<Input, 'slider'>, 'scale' | 'min' | 'max' | 'precision'>
): Scale => {
    switch (input.scale) {
        case 'linear':
            return LINEAR_SCALE;
        case 'log':
            return new LogScale(input.min, input.precision);
        case 'log-offset':
            return new LogScale(input.min + 0.66, input.precision);
        default:
            return assertNever(input.scale);
    }
};

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
            label,
        } = input;

        const [inputString, setInputString] = useState(String(value));
        const [sliderValue, setSliderValue] = useState(value ?? def);

        const precisionOutput = useCallback(
            (val: number) => (hideTrailingZeros ? String(val) : val.toFixed(precision)),
            [hideTrailingZeros, precision]
        );

        useEffect(() => {
            setSliderValue(value ?? def);
            if (!Number.isNaN(value)) {
                setInputString(precisionOutput(value ?? def));
            }
        }, [value, def, precisionOutput]);

        const onSliderChange = useCallback(
            (n: number) => {
                setInputString(precisionOutput(n));
                setSliderValue(n);
            },
            [precisionOutput]
        );
        const onNumberInputChange = (numberAsString: string) => {
            setInputString(numberAsString);
            setSliderValue(Number(numberAsString));
        };

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

        const scale = useMemo(() => parseScale(input), [input]);
        const sliderStyle = useMemo((): SliderStyle => {
            if (gradient) {
                return { type: 'gradient', gradient };
            }
            if (!filled) {
                return { type: 'no-fill' };
            }
            return { type: 'label', label };
        }, [label, gradient, filled]);

        const slider = (
            <VStack w="full">
                <HStack w="full">
                    {ends[0] && <Text fontSize="xs">{ends[0]}</Text>}
                    <CustomSlider
                        def={def}
                        isDisabled={isLocked || isInputConnected}
                        max={max}
                        min={min}
                        scale={scale}
                        step={sliderStep}
                        style={sliderStyle}
                        tooltip={`${precisionOutput(displaySliderValue)}${unit ?? ''}`}
                        value={displaySliderValue}
                        onChange={onSliderChange}
                        onChangeEnd={setValue}
                    />
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

        if (sliderStyle.type === 'label') {
            return <Box py={1}>{slider}</Box>;
        }

        return <WithLabel input={input}>{slider}</WithLabel>;
    }
);
