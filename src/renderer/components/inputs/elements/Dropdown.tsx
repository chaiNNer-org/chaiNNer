import { Select } from '@chakra-ui/react';
import { ChangeEvent, memo, useEffect } from 'react';
import { DropDownInput, DropdownGroup, InputSchemaValue } from '../../../../common/common-types';

export interface DropDownProps {
    value: InputSchemaValue | undefined;
    onChange: (value: InputSchemaValue) => void;
    reset: () => void;
    isDisabled?: boolean;
    options: DropDownInput['options'];
    groups?: readonly DropdownGroup[];
}

export const DropDown = memo(
    ({ value, onChange, reset, isDisabled, options, groups }: DropDownProps) => {
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

        const optionElements: JSX.Element[] = [];
        // eslint-disable-next-line @typescript-eslint/no-shadow
        for (const [o, index] of options.map((o, i) => [o, i] as const)) {
            const group = groups?.find((c) => c.startAt === o.value);
            if (group) {
                const pseudoValue = `--category-${index}-${group.label ?? ''}`;

                if (group.label) {
                    optionElements.push(
                        <option
                            disabled
                            key={optionElements.length}
                            style={{ fontSize: '30%' }}
                            value={`--pad-${pseudoValue}`}
                        >
                            {' '}
                        </option>,
                        <option
                            disabled
                            key={optionElements.length + 1}
                            style={{
                                fontSize: '110%',
                                fontWeight: 'bold',
                                textAlign: 'center',
                            }}
                            value={pseudoValue}
                        >
                            {group.label}
                        </option>
                    );
                } else {
                    optionElements.push(
                        <option
                            disabled
                            key={optionElements.length}
                            style={{
                                fontSize: '85%',
                                color: 'rgba(128 128 128 / 70%)',
                            }}
                            value={`--hr-${pseudoValue}`}
                        >
                            {'\u23AF'.repeat(30)}
                        </option>
                    );
                }
            }

            optionElements.push(
                <option
                    key={optionElements.length}
                    style={{ fontSize: '120%' }}
                    value={index}
                >
                    {o.option}
                </option>
            );
        }

        return (
            <Select
                borderRadius="lg"
                className="nodrag"
                disabled={isDisabled}
                draggable={false}
                size="sm"
                style={{ contain: 'size' }}
                value={selection}
                onChange={handleChange}
            >
                {optionElements}
            </Select>
        );
    }
);
