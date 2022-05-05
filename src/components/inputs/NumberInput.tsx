import {
    NumberDecrementStepper,
    NumberIncrementStepper,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
} from '@chakra-ui/react';
import { memo, useContext, useState } from 'react';
import { GlobalContext } from '../../helpers/contexts/GlobalNodeState';

interface NumericalInputProps {
    id: string;
    index: number;
    isLocked?: boolean;
    label: string;
    type: string;
    min?: number;
    max?: number;
    precision?: number;
    step?: number;
    def?: number;
}

const NumericalInput = memo(
    ({ label, id, index, def, min, max, precision, step, type, isLocked }: NumericalInputProps) => {
        const { useInputData, useNodeLock } = useContext(GlobalContext);
        // TODO: make sure this is always a number
        const [input, setInput] = useInputData<number>(id, index);
        const [inputString, setInputString] = useState(String(input));
        const [, , isInputLocked] = useNodeLock(id, index);

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
                isDisabled={isLocked || isInputLocked}
                draggable={false}
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
