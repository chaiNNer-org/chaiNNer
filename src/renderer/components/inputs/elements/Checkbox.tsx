import { Box, Checkbox as ChakraCheckbox } from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { DropDownInput, InputSchemaValue } from '../../../../common/common-types';
import './Checkbox.scss';

type ArrayItem<T> = T extends readonly (infer I)[] ? I : never;
type Option = ArrayItem<DropDownInput['options']>;

export interface CheckboxProps {
    value: InputSchemaValue | undefined;
    onChange: (value: InputSchemaValue) => void;
    reset: () => void;
    isDisabled?: boolean;
    yes: Option;
    no: Option;
    label: string;
}

export const Checkbox = memo(
    ({ value, onChange, reset, isDisabled, yes, no, label }: CheckboxProps) => {
        // reset invalid values to default
        useEffect(() => {
            if (value === undefined || (yes.value !== value && no.value !== value)) {
                reset();
            }
        }, [value, reset, yes, no]);

        return (
            <ChakraCheckbox
                className="chainner-node-checkbox"
                colorScheme="gray"
                isChecked={value === yes.value}
                isDisabled={isDisabled}
                onChange={(e) => {
                    const selected = e.target.checked ? yes : no;
                    onChange(selected.value);
                }}
            >
                <Box
                    as="span"
                    fontSize="14px"
                    verticalAlign="text-top"
                >
                    {label}
                </Box>
            </ChakraCheckbox>
        );
    },
);
