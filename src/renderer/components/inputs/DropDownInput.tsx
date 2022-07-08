import { Select } from '@chakra-ui/react';
import { ChangeEvent, memo, useEffect } from 'react';
import { InputOption } from '../../../common/common-types';
import { InputProps } from './props';

interface DropDownInputProps extends InputProps {
    options: readonly InputOption[];
}

export const DropDownInput = memo(
    ({ options, inputId, useInputData, isLocked }: DropDownInputProps) => {
        const [input, setInput] = useInputData<string | number>(inputId);

        const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
            setInput(options[Number(event.target.value)]?.value ?? options[0].value);
        };

        useEffect(() => {
            if (input === undefined) {
                setInput(options[0].value);
            }
        }, []);

        let selection = options.findIndex((o) => o.value === input);
        if (selection === -1) selection = 0;

        return (
            <Select
                className="nodrag"
                disabled={isLocked}
                draggable={false}
                value={selection}
                onChange={handleChange}
            >
                {options.map(({ option }, index) => (
                    <option
                        key={option}
                        value={index}
                    >
                        {option}
                    </option>
                ))}
            </Select>
        );
    }
);
