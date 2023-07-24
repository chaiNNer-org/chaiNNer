import {
    InputGroup,
    InputLeftAddon,
    NumberDecrementStepper,
    NumberIncrementStepper,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
} from '@chakra-ui/react';
import { MouseEventHandler, memo } from 'react';
import { areApproximatelyEqual, noop, stopPropagation } from '../../../../common/util';

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
        const onBlur = noRepeatOnBlur
            ? noop
            : () => {
                  const valAsNumber =
                      precision > 0
                          ? parseFloat(inputString || String(defaultValue))
                          : Math.round(parseFloat(inputString || String(defaultValue)));

                  if (!Number.isNaN(valAsNumber)) {
                      const value = Number(clamp(valAsNumber, min, max).toFixed(precision));

                      // Make sure the input value has been altered so onChange gets correct value if adjustment needed
                      setImmediate(() => {
                          setInput(value);
                          setInputString(
                              hideTrailingZeros ? String(value) : value.toFixed(precision)
                          );
                      });
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
                        max={max}
                        min={min}
                        size="xs"
                        step={controlsStep}
                        value={inputString}
                        onBlur={onBlur}
                        onChange={setInputString}
                        onKeyDown={stopPropagation}
                    >
                        <NumberInputField
                            borderLeftRadius={unit ? 0 : 'md'}
                            borderRightRadius="md"
                            h={inputHeight}
                            m={0}
                            p={1}
                            size={1}
                            w={inputWidth}
                        />
                        <NumberInputStepper w={4}>
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
                    max={max}
                    min={min}
                    size="sm"
                    step={controlsStep}
                    value={inputString}
                    w="full"
                    onBlur={onBlur}
                    onChange={setInputString}
                    onKeyDown={stopPropagation}
                >
                    <NumberInputField
                        borderLeftRadius={unit ? 0 : 'lg'}
                        borderRightRadius="lg"
                        px={unit ? 2 : 4}
                        size={1}
                        w={inputWidth}
                    />
                    <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                    </NumberInputStepper>
                </NumberInput>
            </InputGroup>
        );
    }
);
