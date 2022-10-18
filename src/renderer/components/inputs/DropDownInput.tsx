import { Select } from '@chakra-ui/react';
import { ChangeEvent, memo, useEffect } from 'react';
import { NewInputProps } from './props';

export const DropDownInput = memo(
    ({ value, setValue, input, isLocked }: NewInputProps<'dropdown', string | number>) => {
        const { options } = input;
        const def = options[0].value;

        const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
            setValue(options[Number(event.target.value)]?.value ?? def);
        };

        useEffect(() => {
            if (value === undefined) {
                setValue(def);
            }
        }, []);

        let selection = options.findIndex((o) => o.value === value);
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
