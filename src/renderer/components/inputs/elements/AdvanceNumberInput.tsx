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
import { CSSProperties, MouseEventHandler, memo, useCallback, useEffect, useRef } from 'react';
import './AdvancedNumberInput.scss';

const validChars = /^[\w.+\-*()^!%&|~ /]$/iu;
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

    alignSelf?: CSSProperties['alignSelf'];
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

        alignSelf,
    }: AdvancedNumberInputProps) => {
        const getNumericValue = (): number | undefined => {
            const rawNumber = inputString.trim() ? parseNumberString(inputString) : (defaultValue ?? 0);
            const valAsNumber = precision > 0 ? rawNumber : Math.round(rawNumber);

            if (!Number.isNaN(valAsNumber)) {
                return Number(clamp(valAsNumber, min, max).toFixed(precision));
            }
        };
        const setValue = (value: number): void => {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            cancelAutoCommit();

            setInput(value);
            const formatted = hideTrailingZeros ? String(value) : value.toFixed(precision);
            setInputString(formatted);
        };

        // auto commit system to set value after a delay
        const timerRef = useRef<NodeJS.Timeout | null>(null);
        const autoCommit = () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }

            timerRef.current = setTimeout(() => {
                const value = getNumericValue();
                if (value !== undefined) {
                    setValue(value);
                }
            }, 500);
        };
        const cancelAutoCommit = useCallback(() => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        }, []);
        useEffect(() => {
            cancelAutoCommit();
        }, [inputString, cancelAutoCommit]);

        // event handlers
        const onBlur = () => {
            cancelAutoCommit();
            if (noRepeatOnBlur) return;
            const value = getNumericValue();
            if (value !== undefined) {
                // Make sure the input value has been altered so onChange gets correct value if adjustment needed
                setTimeout(() => setValue(value), 0);
            }
        };
        const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            cancelAutoCommit();
            if (e.key === 'Enter') {
                const value = getNumericValue();
                if (value !== undefined) {
                    setValue(value);
                }
            }
        };
        const onClick = (e: React.MouseEvent<HTMLElement>) => {
            if (e.target instanceof HTMLElement || e.target instanceof SVGElement) {
                const buttonSelector = 'div.small-stepper > div[role=button]';
                const isStepperButton = e.target.matches(`${buttonSelector}, ${buttonSelector} *`);
                if (isStepperButton) {
                    autoCommit();
                }
            }
        };

        if (small) {
            return (
                <InputGroup
                    alignSelf={alignSelf}
                    mx={0}
                    size="xs"
                    w="fit-content"
                    onClick={onClick}
                    onContextMenu={onContextMenu}
                    onMouseDown={cancelAutoCommit}
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
                            pl={1}
                            pr={4}
                            py={1}
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
                alignSelf={alignSelf}
                size="sm"
                w="full"
                onClick={onClick}
                onContextMenu={onContextMenu}
                onMouseDown={cancelAutoCommit}
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
                        pl={unit ? 2 : undefined}
                        pr="var(--number-input-stepper-width)"
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
