import {
    NumberDecrementStepper,
    NumberIncrementStepper,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
} from '@chakra-ui/react';
import { memo, useState } from 'react';
import { useContextSelector } from 'use-context-selector';
import { GlobalChainContext } from '../../helpers/contexts/GlobalNodeState';
import { InputProps } from './props';

interface NumericalInputProps extends InputProps {
    type: string;
    min?: number;
    max?: number;
    precision?: number;
    step?: number;
    def?: number;
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
        step,
        type,
        isLocked,
    }: NumericalInputProps) => {
        const isNodeInputLocked = useContextSelector(
            GlobalChainContext,
            (c) => c.isNodeInputLocked
        );

        // TODO: make sure this is always a number
        const [input, setInput] = useInputData<number>(index);
        const [inputString, setInputString] = useState(String(input));
        const isInputLocked = isNodeInputLocked(id, index);

        const handleChange = (numberAsString: string, numberAsNumber: number) => {
            setInputString(numberAsString);

            if (!Number.isNaN(numberAsNumber)) {
                if (type.includes('odd')) {
                    // Make the number odd if need be
                    // round up the nearest odd number
                    // eslint-disable-next-line no-param-reassign
                    numberAsNumber += 1 - (numberAsNumber % 2);
                }
                setInput(numberAsNumber);
            }
        };

        return (
            <NumberInput
                className="nodrag"
                defaultValue={def}
                draggable={false}
                isDisabled={isLocked || isInputLocked}
                max={max ?? Infinity}
                min={min ?? -Infinity}
                placeholder={label}
                precision={precision}
                step={step ?? 1}
                value={inputString}
                onChange={handleChange}
            >
                <NumberInputField />
                <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                </NumberInputStepper>
            </NumberInput>
        );
    }
);

export default NumericalInput;
