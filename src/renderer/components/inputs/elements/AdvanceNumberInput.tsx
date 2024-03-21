import {
    InputGroup,
    InputLeftAddon,
    NumberDecrementStepper,
    NumberIncrementStepper,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
} from '@chakra-ui/react';
import { evaluate, isBigNumber, isComplex, isFraction, isNumber, isUnit, number } from 'mathjs';
import { MouseEventHandler, memo } from 'react';
import { areApproximatelyEqual, noop } from '../../../../common/util';
import './AdvancedNumberInput.scss';

const validChars = /^[0-9a-z.+\-*()^!%&|~_ /]$/iu;
const isValidChar = (c: string): boolean => validChars.test(c);
const parseNumberString = (s: string): number => {
    try {
        const result = evaluate(s.replace(/\*\*/g, ' ^ ')) as unknown;
        if (isNumber(result)) return result;
        // ignore units
        if (isUnit(result)) return result.toNumber();
        // just return the real part of complex numbers
        if (isComplex(result)) return result.re;
        // just return the real part of complex numbers
        if (isBigNumber(result)) return result.toNumber();
        if (isFraction(result)) return number(result);
    } catch {
        // noop
    }
    return parseFloat(s);
};

const clamp = (value: number, min?: number | null, max?: number | null): number => {
    if (min != null && value < min) return min;
    if (max != null && value > max) return max;
    return value;
};

export const getPrecision = (n: number) => {
    if (n >= 1) {
        // eslint-disable-next-line no-param-reassign
        n %= 1;
        if (areApproximatelyEqual(n, 0)) return 0;
    }
    if (n === 0) return 0;
    return Math.min(10, n.toFixed(100).replace(/0+$/, '').split('.')[1]?.length ?? 0);
};

interface AdvancedNumberInputProps {
    unit?: string | null;
    max: number;
    min: number;
    precision: number;
    controlsStep: number;
    hideTrailingZeros: boolean;

    defaultValue: number;
    isDisabled?: boolean;
    small?: true;

    inputString: string;
    setInputString: (input: string) => void;
    setInput: (value: number) => void;

    onContextMenu?: MouseEventHandler<HTMLElement> | undefined;
    inputWidth?: string;
    inputHeight?: string;
    noRepeatOnBlur?: boolean;
}

export const AdvancedNumberInput = memo(
    ({
        unit,
        max,
        min,
        precision,
        controlsStep,
        hideTrailingZeros,

        defaultValue,
        isDisabled,
        small,

        inputString,
        setInputString,
        setInput,

        onContextMenu,
        inputWidth,
        inputHeight,
        noRepeatOnBlur = false,
    }: AdvancedNumberInputProps) => {
        const getNumericValue = (): number | undefined => {
            const rawNumber = inputString.trim() ? parseNumberString(inputString) : defaultValue;
            const valAsNumber = precision > 0 ? rawNumber : Math.round(rawNumber);

            if (!Number.isNaN(valAsNumber)) {
                return Number(clamp(valAsNumber, min, max).toFixed(precision));
            }
        };
        const formatValue = (value: number): string =>
            hideTrailingZeros ? String(value) : value.toFixed(precision);
        const onBlur = noRepeatOnBlur
            ? noop
            : () => {
                  const value = getNumericValue();
                  if (value !== undefined) {
                      // Make sure the input value has been altered so onChange gets correct value if adjustment needed
                      setImmediate(() => {
                          setInput(value);
                          setInputString(formatValue(value));
                      });
                  }
              };

        const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                const value = getNumericValue();
                if (value !== undefined) {
                    setInput(value);
                    setInputString(formatValue(value));
                }
            }
        };

        if (small) {
            return (
                <InputGroup
                    mx={0}
                    size="xs"
                    w="fit-content"
                    onContextMenu={onContextMenu}
                >
                    {unit && (
                        <InputLeftAddon
                            borderLeftRadius="md"
                            h={inputHeight}
                            px={1}
                            w="fit-content"
                        >
                            {unit}
                        </InputLeftAddon>
                    )}
                    <NumberInput
                        borderRadius="md"
                        className="nodrag"
                        defaultValue={defaultValue}
                        draggable={false}
                        isDisabled={isDisabled}
                        isValidCharacter={isValidChar}
                        max={max}
                        min={min}
                        size="xs"
                        step={controlsStep}
                        value={inputString}
                        onBlur={onBlur}
                        onChange={setInputString}
                    >
                        <NumberInputField
                            borderLeftRadius={unit ? 0 : 'md'}
                            borderRightRadius="md"
                            h={inputHeight}
                            m={0}
                            p={1}
                            size={1}
                            w={inputWidth}
                            onKeyDown={onKeyDown}
                        />
                        <NumberInputStepper
                            className="small-stepper"
                            w={4}
                        >
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                        </NumberInputStepper>
                    </NumberInput>
                </InputGroup>
            );
        }

        return (
            <InputGroup
                size="sm"
                w="full"
                onContextMenu={onContextMenu}
            >
                {unit && (
                    <InputLeftAddon
                        borderLeftRadius="lg"
                        px={2}
                        w="fit-content"
                    >
                        {unit}
                    </InputLeftAddon>
                )}
                <NumberInput
                    borderRadius="lg"
                    className="nodrag"
                    defaultValue={defaultValue}
                    draggable={false}
                    isDisabled={isDisabled}
                    isValidCharacter={isValidChar}
                    max={max}
                    min={min}
                    size="sm"
                    step={controlsStep}
                    value={inputString}
                    w="full"
                    onBlur={onBlur}
                    onChange={setInputString}
                >
                    <NumberInputField
                        borderLeftRadius={unit ? 0 : 'lg'}
                        borderRightRadius="lg"
                        px={unit ? 2 : 4}
                        size={1}
                        w={inputWidth}
                        onKeyDown={onKeyDown}
                    />
                    <NumberInputStepper className="small-stepper">
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                    </NumberInputStepper>
                </NumberInput>
            </InputGroup>
        );
    }
);
