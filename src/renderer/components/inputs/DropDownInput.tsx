import { Select } from '@chakra-ui/react';
import { ChangeEvent, memo, useEffect } from 'react';
import { InputProps } from './props';

type DropDownInputProps = Pick<
    InputProps<'dropdown', string | number>,
    'value' | 'setValue' | 'input' | 'isLocked'
>;

export const DropDownInput = memo(({ value, setValue, input, isLocked }: DropDownInputProps) => {
    const { options, def } = input;

    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
        setValue(options[Number(event.target.value)]?.value ?? def);
    };

    // set default
    useEffect(() => {
        if (value === undefined) {
            setValue(def);
        }
    }, [value, setValue, def]);

    // reset invalid values to default
    useEffect(() => {
        if (value !== undefined && options.every((o) => o.value !== value)) {
            setValue(def);
        }
    }, [value, setValue, options, def]);

    let selection = options.findIndex((o) => o.value === value);
    if (selection === -1) selection = 0;

    return (
        <Select
            borderRadius="lg"
            className="nodrag"
            disabled={isLocked}
            draggable={false}
            size="sm"
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
});
