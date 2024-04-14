import { TabList as ChakraTabList, Tab, TabIndicator, Tabs } from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { DropDownInput, InputSchemaValue } from '../../../../common/common-types';
import { noop } from '../../../../common/util';

export interface TabListProps {
    value: InputSchemaValue | undefined;
    onChange: (value: InputSchemaValue) => void;
    reset: () => void;
    isDisabled?: boolean;
    options: DropDownInput['options'];
}

export const TabList = memo(({ value, onChange, reset, isDisabled, options }: TabListProps) => {
    // reset invalid values to default
    useEffect(() => {
        if (value === undefined || options.every((o) => o.value !== value)) {
            reset();
        }
    }, [value, reset, options]);

    let selection = options.findIndex((o) => o.value === value);
    if (selection === -1) selection = 0;

    const handleTabClick = (index: number, event: React.MouseEvent) => {
        if (event.button === 0) {
            // Check if left mouse button was clicked
            const selectedValue = options[index]?.value as InputSchemaValue | undefined;
            if (selectedValue !== undefined) {
                onChange(selectedValue);
            }
        }
    };

    return (
        <Tabs
            isFitted
            className="nodrag"
            index={selection}
            mt="-0.25rem"
            mx="-0.5rem"
            pb={1}
            position="relative"
            pt={1}
            size="sm"
            variant="unstyled"
            onChange={noop}
        >
            <ChakraTabList
                borderBottom="1px solid"
                borderColor="var(--chakra-colors-chakra-border-color)"
            >
                {options.map(({ option }, i) => {
                    const selected = i === selection;

                    return (
                        <Tab
                            isDisabled={isDisabled}
                            key={option}
                            opacity={selected ? 1 : 0.8}
                            px={2}
                            onMouseDown={(event) => handleTabClick(i, event)}
                        >
                            {option}
                        </Tab>
                    );
                })}
            </ChakraTabList>
            <TabIndicator
                bg="currentColor"
                height="2px"
                mt="-2px"
                opacity={0.8}
            />
        </Tabs>
    );
});
