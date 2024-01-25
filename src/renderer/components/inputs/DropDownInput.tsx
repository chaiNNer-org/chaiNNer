import { QuestionIcon } from '@chakra-ui/icons';
import { Tooltip } from '@chakra-ui/react';
import { memo, useCallback } from 'react';
import { Markdown } from '../Markdown';
import { Checkbox } from './elements/Checkbox';
import { DropDown } from './elements/Dropdown';
import { TabList } from './elements/TabList';
import { AutoLabel, WithoutLabel } from './InputContainer';
import { InputProps } from './props';

type DropDownInputProps = InputProps<'dropdown', string | number>;

export const DropDownInput = memo(({ value, setValue, input, isLocked }: DropDownInputProps) => {
    const { options, def, label, preferredStyle, groups, hint, description } = input;

    const reset = useCallback(() => setValue(def), [setValue, def]);

    if (preferredStyle === 'checkbox' && options.length === 2) {
        // checkbox assumes the first options means yes and the second option means no

        let afterText;
        if (hint && description) {
            afterText = (
                <Tooltip
                    hasArrow
                    borderRadius={8}
                    label={<Markdown nonInteractive>{description}</Markdown>}
                    openDelay={500}
                    px={2}
                    py={1}
                >
                    <QuestionIcon
                        boxSize={3}
                        ml={1}
                        verticalAlign="baseline"
                    />
                </Tooltip>
            );
        }
        return (
            <WithoutLabel>
                <Checkbox
                    afterText={afterText}
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
        <AutoLabel input={input}>
            <DropDown
                groups={groups}
                isDisabled={isLocked}
                options={input.options}
                reset={reset}
                value={value}
                onChange={setValue}
            />
        </AutoLabel>
    );
});
