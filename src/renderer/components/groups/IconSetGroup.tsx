import { Button, ButtonGroup, Tooltip } from '@chakra-ui/react';
import { memo, useEffect } from 'react';
import { DropDownInput, InputOption, InputSchemaValue } from '../../../common/common-types';
import { NodeState, getPassthroughIgnored } from '../../helpers/nodeState';
import { IconFactory } from '../CustomIcons';
import { InlineLabel, InputContainer } from '../inputs/InputContainer';
import { GroupProps } from './props';

interface SingleIconProps {
    value: InputSchemaValue | undefined;
    onChange: (value: InputSchemaValue) => void;
    reset: () => void;
    isDisabled?: boolean;
    yes: InputOption;
    no: InputOption;
    label: string;
    leftIsSelected: boolean;
}

const SingleIcon = memo(
    ({ value, onChange, reset, isDisabled, yes, no, label, leftIsSelected }: SingleIconProps) => {
        // reset invalid values to default
        useEffect(() => {
            if (value === undefined || (yes.value !== value && no.value !== value)) {
                reset();
            }
        }, [value, reset, yes, no]);

        const selected = value === yes.value;

        return (
            <Tooltip
                closeOnClick
                closeOnPointerDown
                hasArrow
                borderRadius={8}
                isDisabled={isDisabled}
                label={label}
                openDelay={500}
                placement="top"
            >
                <Button
                    border={selected ? '1px solid' : undefined}
                    borderLeft={leftIsSelected ? 'none' : undefined}
                    boxSizing="content-box"
                    height="calc(2rem - 2px)"
                    isDisabled={isDisabled}
                    minWidth={0}
                    px={2}
                    variant={selected ? 'solid' : 'outline'}
                    onClick={() => onChange(selected ? no.value : yes.value)}
                >
                    <IconFactory icon={yes.icon ?? label[0]} />
                </Button>
            </Tooltip>
        );
    }
);

interface IconSetProps {
    inputs: readonly DropDownInput[];
    nodeState: NodeState;
}
export const IconSet = memo(({ inputs, nodeState }: IconSetProps) => {
    const { inputData, setInputValue, isLocked } = nodeState;

    return (
        <ButtonGroup
            isAttached
            className="nodrag"
            variant="outline"
        >
            {inputs.map((input, i) => {
                const value = inputData[input.id];

                let leftIsSelected = false;
                if (i > 0) {
                    const rightInput = inputs[i - 1];
                    const rightValue = inputData[rightInput.id];
                    const rightYes = rightInput.options[0];
                    leftIsSelected = rightValue === rightYes.value;
                }

                return (
                    <SingleIcon
                        isDisabled={isLocked}
                        key={input.id}
                        label={input.label}
                        leftIsSelected={leftIsSelected}
                        no={input.options[1]}
                        reset={() => setInputValue(input.id, input.def)}
                        value={value}
                        yes={input.options[0]}
                        onChange={(v) => setInputValue(input.id, v)}
                    />
                );
            })}
        </ButtonGroup>
    );
});

export const IconSetGroup = memo(({ inputs, nodeState, group }: GroupProps<'icon-set'>) => {
    const { label } = group.options;

    return (
        <InputContainer passthroughIgnored={getPassthroughIgnored(nodeState)}>
            <InlineLabel input={{ label }}>
                <IconSet
                    inputs={inputs}
                    nodeState={nodeState}
                />
            </InlineLabel>
        </InputContainer>
    );
});
