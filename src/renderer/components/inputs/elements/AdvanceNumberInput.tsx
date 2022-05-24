import {
    InputGroup,
    InputLeftAddon,
    NumberDecrementStepper,
    NumberIncrementStepper,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    ThemingProps,
} from '@chakra-ui/react';
import { memo } from 'react';
import { clamp, getPrecision } from '../../../../common/util';

interface AdvancedNumberInputProps {
    unit?: string | null;
    max: number;
    min: number;
    offset: number;
    step: number;
    controlsStep: number;

    defaultValue?: number;
    isDisabled?: boolean;
    small?: true;

    inputString: string;
    setInputString: (input: string) => void;
    setInput: (value: number) => void;
}

export const AdvancedNumberInput = memo(
    ({
        unit,
        max,
        min,
        offset,
        step,
        controlsStep,

        defaultValue,
        isDisabled,
        small,

        inputString,
        setInputString,
        setInput,
    }: AdvancedNumberInputProps) => {
        const precision = Math.max(getPrecision(offset), getPrecision(step));

        const onBlur = () => {
            const valAsNumber =
                precision > 0
                    ? parseFloat(inputString || String(defaultValue))
                    : Math.round(parseFloat(inputString || String(defaultValue)));

            if (!Number.isNaN(valAsNumber)) {
                const roundedVal = Math.round((valAsNumber - offset) / step) * step + offset;
                const value = Number(clamp(roundedVal, min, max).toFixed(precision));

                // Make sure the input value has been altered so onChange gets correct value if adjustment needed
                setImmediate(() => {
                    setInput(value);
                    setInputString(String(value));
                });
            }
        };

        const size = small && 'xs';

        return (
            <InputGroup
                mx={0}
                size={size}
                w={small && 'fit-content'}
            >
                {unit && (
                    <InputLeftAddon
                        px={small ? 1 : 2}
                        w="fit-content"
                    >
                        {unit}
                    </InputLeftAddon>
                )}
                <NumberInput
                    className="nodrag"
                    defaultValue={defaultValue}
                    draggable={false}
                    isDisabled={isDisabled}
                    max={max}
                    min={min}
                    size={size}
                    step={controlsStep}
                    value={inputString}
                    onBlur={onBlur}
                    onChange={setInputString}
                >
                    <NumberInputField
                        // eslint-disable-next-line no-nested-ternary
                        borderLeftRadius={unit ? 0 : small ? 'xs' : 'md'}
                        m={0}
                        p={1}
                        px={unit ? 2 : 4}
                        // dynamic width based on precision
                        w={small && `${3 + 0.5 * precision}em`}
                    />
                    <NumberInputStepper w={4}>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                    </NumberInputStepper>
                </NumberInput>
            </InputGroup>
        );
    }
);
