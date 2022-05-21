import {
    HStack,
    NumberDecrementStepper,
    NumberIncrementStepper,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
} from '@chakra-ui/react';
import { memo, useEffect, useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { areApproximatelyEqual } from '../../../common/util';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { InputProps } from './props';

interface NumericalInputProps extends InputProps {
    offset: number;
    step: number;
    controlsStep: number;
    min?: number;
    max?: number;
    def?: number;
    unit?: string | null;
}

export const getPrecision = (n: number) => {
    if (n % 1 === 0) return 0;
    return Math.min(10, n.toFixed(15).replace(/0+$/, '').split('.')[1]?.length ?? 0);
};

const NumericalInput = memo(
    ({
        label,
        id,
        index,
        useInputData,
        def,
        min,
        max,
        offset,
        step,
        controlsStep,
        unit,
        isLocked,
    }: NumericalInputProps) => {
        const isInputLocked = useContextSelector(GlobalVolatileContext, (c) => c.isNodeInputLocked)(
            id,
            index
        );

        const precision = Math.max(getPrecision(offset), getPrecision(step));
        const addUnit = (val: string) => `${val}${unit ?? ''}`;
        const removeUnit = (val: string) =>
            unit && val.endsWith(unit) ? val.slice(0, val.length - unit.length) : val;

        // TODO: make sure this is always a number
        const [input, setInput] = useInputData<number>(index);
        const [inputString, setInputString] = useState(String(input));

        useEffect(() => {
            const asNumber = parseFloat(inputString);
            if (!Number.isNaN(asNumber) && !areApproximatelyEqual(asNumber, input!)) {
                setInputString(String(input));
            }
        }, [input]);

        const handleChange = (numberAsString: string) => {
            setInputString(removeUnit(numberAsString));
        };

        const onBlur = () => {
            const valAsNumber =
                precision > 0 ? parseFloat(inputString) : Math.round(parseFloat(inputString));

            if (!Number.isNaN(valAsNumber)) {
                const roundedVal = Math.round((valAsNumber - offset) / step) * step + offset;

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

        return (
            <HStack w="full">
                <NumberInput
                    className="nodrag"
                    defaultValue={def}
                    draggable={false}
                    isDisabled={isLocked || isInputLocked}
                    max={max ?? Infinity}
                    min={min ?? -Infinity}
                    placeholder={label}
                    step={controlsStep}
                    value={addUnit(inputString)}
                    onBlur={onBlur}
                    onChange={handleChange}
                >
                    <NumberInputField />
                    <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                    </NumberInputStepper>
                </NumberInput>
            </HStack>
        );
    }
);

export default NumericalInput;
