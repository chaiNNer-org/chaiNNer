import { memo, useCallback } from 'react';
import { Checkbox } from './elements/Checkbox';
import { DropDown } from './elements/Dropdown';
import { TabList } from './elements/TabList';
import { WithLabel, WithoutLabel } from './InputContainer';
import { InputProps } from './props';

type DropDownInputProps = InputProps<'dropdown', string | number>;

export const DropDownInput = memo(({ value, setValue, input, isLocked }: DropDownInputProps) => {
    const { options, def, label, preferredStyle, groups } = input;

    const reset = useCallback(() => setValue(def), [setValue, def]);

    if (preferredStyle === 'checkbox' && options.length === 2) {
        // checkbox assumes the first options means yes and the second option means no
        return (
            <WithoutLabel>
                <Checkbox
                    isDisabled={isLocked}
                    label={label}
                    no={options[1]}
                    reset={reset}
                    value={value}
                    yes={options[0]}
                    onChange={setValue}
                />
            </WithoutLabel>
        );
    }

    if (preferredStyle === 'tabs') {
        return (
            <WithoutLabel>
                <TabList
                    isDisabled={isLocked}
                    options={input.options}
                    reset={reset}
                    value={value}
                    onChange={setValue}
                />
            </WithoutLabel>
        );
    }

    return (
        <WithLabel input={input}>
            <DropDown
                groups={groups}
                isDisabled={isLocked}
                options={input.options}
                reset={reset}
                value={value}
                onChange={setValue}
            />
        </WithLabel>
    );
});
