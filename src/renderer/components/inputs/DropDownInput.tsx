import { Box } from '@chakra-ui/react';
import { memo, useCallback } from 'react';
import { Checkbox } from './elements/Checkbox';
import { DropDown } from './elements/Dropdown';
import { WithLabel } from './InputContainer';
import { InputProps } from './props';

type DropDownInputProps = InputProps<'dropdown', string | number>;

export const DropDownInput = memo(({ value, setValue, input, isLocked }: DropDownInputProps) => {
    const { options, def, label } = input;

    const reset = useCallback(() => setValue(def), [setValue, def]);

    if (options.length === 2 && options[0].option === 'Yes') {
        return (
            <Box py={1}>
                <Checkbox
                    label={label}
                    no={options[1]}
                    reset={reset}
                    value={value}
                    yes={options[0]}
                    onChange={setValue}
                />
            </Box>
        );
    }

    return (
        <WithLabel input={input}>
            <DropDown
                isDisabled={isLocked}
                options={input.options}
                reset={reset}
                value={value}
                onChange={setValue}
            />
        </WithLabel>
    );
});
