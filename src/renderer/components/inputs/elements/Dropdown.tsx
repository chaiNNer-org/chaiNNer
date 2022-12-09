import { Select } from '@chakra-ui/react';
import { ChangeEvent, memo, useEffect } from 'react';
import { DropDownInput, InputSchemaValue } from '../../../../common/common-types';

export interface DropDownProps {
    value: InputSchemaValue | undefined;
    onChange: (value: InputSchemaValue) => void;
    reset: () => void;
    isDisabled?: boolean;
    options: DropDownInput['options'];
}

export const DropDown = memo(({ value, onChange, reset, isDisabled, options }: DropDownProps) => {
    // reset invalid values to default
    useEffect(() => {
        if (value === undefined || options.every((o) => o.value !== value)) {
            reset();
        }
    }, [value, reset, options]);

    let selection = options.findIndex((o) => o.value === value);
    if (selection === -1) selection = 0;

    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const selectedIndex = Number(event.target.value);
        const selectedValue = options[selectedIndex]?.value as InputSchemaValue | undefined;
        if (selectedValue === undefined) {
            reset();
        } else {
            onChange(selectedValue);
        }
    };

    return (
        <Select
            borderRadius="lg"
            className="nodrag"
            disabled={isDisabled}
            draggable={false}
            size="sm"
            value={selection}
            onChange={handleChange}
        >
            {options.map(({ option }, index) => (
                <option
                    key={option}
                    style={{ fontSize: '120%' }}
                    value={index}
                >
                    {option}
                </option>
            ))}
        </Select>
    );
});
