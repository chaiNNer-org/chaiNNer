import { Button, ButtonGroup, Tooltip } from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { DropDownInput, InputSchemaValue } from '../../../../common/common-types';
import { IconFactory } from '../../CustomIcons';

export interface IconListProps {
    value: InputSchemaValue | undefined;
    onChange: (value: InputSchemaValue) => void;
    reset: () => void;
    isDisabled?: boolean;
    options: DropDownInput['options'];
}

export const IconList = memo(({ value, onChange, reset, isDisabled, options }: IconListProps) => {
    // reset invalid values to default
    useEffect(() => {
        if (value === undefined || options.every((o) => o.value !== value)) {
            reset();
        }
    }, [value, reset, options]);

    let selection = options.findIndex((o) => o.value === value);
    if (selection === -1) selection = 0;

    return (
        <ButtonGroup
            isAttached
            className="nodrag"
            variant="outline"
        >
            {options.map((o, i) => {
                const selected = i === selection;

                // n: var(--chakra-colors-whiteAlpha-200)
                return (
                    <Tooltip
                        closeOnClick
                        closeOnPointerDown
                        hasArrow
                        borderRadius={8}
                        isDisabled={isDisabled}
                        key={o.value}
                        label={o.option}
                        openDelay={200}
                        placement="top"
                    >
                        <Button
                            border={selected ? '1px solid' : undefined}
                            borderLeft={i === selection + 1 ? 'none' : undefined}
                            boxSizing="content-box"
                            height="calc(2rem - 2px)"
                            isDisabled={isDisabled}
                            minWidth={0}
                            px={2}
                            variant={selected ? 'solid' : 'outline'}
                            onClick={() => onChange(o.value)}
                        >
                            <IconFactory icon={o.icon} />
                        </Button>
                    </Tooltip>
                );
            })}
        </ButtonGroup>
    );
});
