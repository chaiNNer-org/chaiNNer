import { Box, Checkbox as ChakraCheckbox } from '@chakra-ui/react';
import { ReactNode, memo } from 'react';
import { DropDownInput, InputSchemaValue } from '../../../../common/common-types';
import './Checkbox.scss';

type ArrayItem<T> = T extends readonly (infer I)[] ? I : never;
type Option = ArrayItem<DropDownInput['options']>;

export interface CheckboxProps {
    value: InputSchemaValue;
    onChange: (value: InputSchemaValue) => void;
    isDisabled?: boolean;
    yes: Option;
    no: Option;
    label: string;
    afterText?: ReactNode;
}

export const Checkbox = memo(
    ({ value, onChange, isDisabled, yes, no, label, afterText }: CheckboxProps) => {
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
                {afterText}
            </ChakraCheckbox>
        );
    }
);
