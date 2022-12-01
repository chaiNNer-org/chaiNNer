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
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Input, OfKind } from '../../../common/common-types';
import { assertNever } from '../../../common/util';
import { getTypeAccentColors } from '../../helpers/getTypeAccentColors';
import { AdvancedNumberInput } from './elements/AdvanceNumberInput';
import { InputProps } from './props';

type ScaledNumber = number & { readonly __scaled: never };
interface Scale {
    toScale(value: number): ScaledNumber;
    fromScale(scaledValue: ScaledNumber): number;
}
const LINEAR_SCALE: Scale = { toScale: (n) => n as ScaledNumber, fromScale: (n) => n };
class LogScale implements Scale {
    public readonly min: number;

    public readonly precision: number;

    constructor(min: number, precision: number) {
        this.min = min;
        this.precision = precision;
    }

    toScale(value: number): ScaledNumber {
        return Math.log1p(value - this.min) as ScaledNumber;
    }

    fromScale(scaledValue: ScaledNumber): number {
        const value = Math.expm1(scaledValue) + this.min;
        return Number(value.toFixed(this.precision));
    }
}

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

        const scale = useMemo(() => parseScale(input), [input]);

        const [inputString, setInputString] = useState(String(value));
        const [sliderValue, setSliderValue] = useState(value ?? def);
        const [showTooltip, setShowTooltip] = useState(false);

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

        const onSliderChange = (sliderInput: ScaledNumber) => {
            const unscaled = scale.fromScale(sliderInput);
            setInputString(precisionOutput(unscaled));
            setSliderValue(unscaled);
        };
        const onSliderChangeEnd = (sliderInput: ScaledNumber) => {
            setValue(scale.fromScale(sliderInput));
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
                        defaultValue={scale.toScale(def)}
                        focusThumbOnChange={false}
                        isDisabled={isLocked || isInputConnected}
                        max={scale.toScale(max)}
                        min={scale.toScale(min)}
                        step={scale === LINEAR_SCALE ? sliderStep : 1e-10}
                        value={scale.toScale(displaySliderValue)}
                        onChange={onSliderChange}
                        onChangeEnd={onSliderChangeEnd}
                        onDoubleClick={() => setValue(def)}
                        onMouseEnter={() => setShowTooltip(true)}
                        onMouseLeave={() => setShowTooltip(false)}
                    >
                        <SliderTrack
                            bgGradient={gradient ? `linear(to-r, ${gradient.join(', ')})` : 'none'}
                            borderRadius="md"
                            cursor="pointer"
                            h="100%"
                        >
                            {filled && !gradient && (
                                <SliderFilledTrack
                                    bg={typeAccentColor}
                                    borderLeftRadius="md"
                                    cursor="pointer"
                                />
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
                            <SliderThumb opacity={filled && !gradient ? 0 : 1} />
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
