import {
    HStack,
    NumberDecrementStepper,
    NumberIncrementStepper,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    Text,
} from '@chakra-ui/react';
import { memo, useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { GlobalVolatileContext } from '../../contexts/GlobalNodeState';
import { InputProps } from './props';

interface NumericalInputProps extends InputProps {
    precision: number;
    offset: number;
    step: number;
    controlsStep: number;
    min?: number;
    max?: number;
    def?: number;
    units?: string | null;
}

const NumericalInput = memo(
    ({
        label,
        id,
        index,
        useInputData,
        def,
        min,
        max,
        precision,
        offset,
        step,
        controlsStep,
        units,
        isLocked,
    }: NumericalInputProps) => {
        const isInputLocked = useContextSelector(GlobalVolatileContext, (c) => c.isNodeInputLocked)(
            id,
            index
        );

        // TODO: make sure this is always a number
        const [input, setInput] = useInputData<number>(index);
        const [inputString, setInputString] = useState(String(input));

        const handleChange = (numberAsString: string, numberAsNumber: number) => {
            setInputString(numberAsString);

            if (!Number.isNaN(numberAsNumber)) {
                setInput(numberAsNumber);
            }
        };

        const onBlur = () => {
            const valAsNumber =
                precision > 0 ? parseFloat(inputString) : Math.round(parseFloat(inputString));

            if (!Number.isNaN(valAsNumber)) {
                const roundedVal = +`${Math.round(
                    +`${Math.round((valAsNumber - offset) / step) * step + offset}e${precision}`
                )}e-${precision}`;

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
                const minClamped = clampMin(maxClamped, min);

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
                    precision={precision}
                    step={controlsStep}
                    value={inputString}
                    onBlur={onBlur}
                    onChange={handleChange}
                >
                    <NumberInputField />
                    <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                    </NumberInputStepper>
                </NumberInput>
                <Text
                    fontSize="xs"
                    m={0}
                    mb={-1}
                    mt={-1}
                    p={0}
                    pb={-1}
                    pt={-1}
                >
                    {units}
                </Text>
            </HStack>
        );
    }
);

export default NumericalInput;
