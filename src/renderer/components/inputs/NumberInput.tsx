import {
    HStack,
    InputGroup,
    InputLeftAddon,
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

const clampMax = (value: number, max_val: number | undefined | null) => {
    if (max_val !== undefined && max_val !== null) {
        const valOrMax = Math.min(value, max_val);
        return valOrMax;
    }
    return value;
};

const clampMin = (value: number, min_val: number | undefined | null) => {
    if (min_val !== undefined && min_val !== null) {
        const valOrMin = Math.max(value, min_val);
        return valOrMin;
    }
    return value;
};

const NumericalInput = memo(
    ({
        label,
        id,
        inputId,
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
            inputId
        );

        const precision = Math.max(getPrecision(offset), getPrecision(step));

        // TODO: make sure this is always a number
        const [input, setInput] = useInputData<number>(inputId);
        const [inputString, setInputString] = useState(String(input));

        useEffect(() => {
            const asNumber = parseFloat(inputString);
            if (!Number.isNaN(asNumber) && !areApproximatelyEqual(asNumber, input!)) {
                setInputString(String(input));
            }
        }, [input]);

        const handleChange = (numberAsString: string) => {
            setInputString(numberAsString);
        };

        const onBlur = () => {
            // If inputString is empty due to clearing input field, set value to default
            const valAsNumber =
                precision > 0
                    ? parseFloat(inputString !== '' ? inputString : String(def))
                    : Math.round(parseFloat(inputString !== '' ? inputString : String(def)));

            if (!Number.isNaN(valAsNumber)) {
                const roundedVal = Math.round((valAsNumber - offset) / step) * step + offset;

                const maxClamped = clampMax(roundedVal, max);

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
                <InputGroup>
                    {unit ? (
                        <InputLeftAddon
                            px={2}
                            w="fit-content"
                        >
                            {unit}
                        </InputLeftAddon>
                    ) : null}
                    <NumberInput
                        className="nodrag"
                        defaultValue={def}
                        draggable={false}
                        isDisabled={isLocked || isInputLocked}
                        max={max ?? Infinity}
                        min={min ?? -Infinity}
                        placeholder={label}
                        step={controlsStep}
                        value={inputString}
                        w={unit ? '90%' : '100%'}
                        onBlur={onBlur}
                        onChange={handleChange}
                    >
                        <NumberInputField
                            borderLeftRadius={unit ? 0 : 'md'}
                            px={unit ? 2 : 4}
                        />
                        <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                        </NumberInputStepper>
                    </NumberInput>
                </InputGroup>
            </HStack>
        );
    }
);

export default NumericalInput;
