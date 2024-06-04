import { Box } from '@chakra-ui/react';
import { memo } from 'react';
import { DropDownInput, InputSchemaValue } from '../../../common/common-types';
import { getUniqueKey } from '../../../common/group-inputs';
import { NodeState, getPassthroughIgnored } from '../../helpers/nodeState';
import { useValidDropDownValue } from '../../hooks/useValidDropDownValue';
import { IconList } from '../inputs/elements/IconList';
import { InputContainer, WithoutLabel } from '../inputs/InputContainer';
import { IconSet } from './IconSetGroup';
import { GroupProps } from './props';

const IconListWrapper = memo(
    ({ input, nodeState }: { input: DropDownInput; nodeState: NodeState }) => {
        const setValue = (value: InputSchemaValue) => nodeState.setInputValue(input.id, value);
        const value = useValidDropDownValue(nodeState.inputData[input.id], setValue, input);

        return (
            <IconList
                isDisabled={nodeState.isLocked}
                options={input.options}
                value={value}
                onChange={setValue}
            />
        );
    }
);

export const MenuIconRowGroup = memo(({ inputs, nodeState }: GroupProps<'menu-icon-row'>) => {
    return (
        <InputContainer passthroughIgnored={getPassthroughIgnored(nodeState)}>
            <WithoutLabel>
                <Box
                    display="flex"
                    gap={2}
                    pl={2}
                >
                    {inputs.map((item) => {
                        const key = getUniqueKey(item);
                        if (item.kind === 'group' && item.group.kind === 'icon-set') {
                            return (
                                <IconSet
                                    inputs={item.inputs as never}
                                    key={key}
                                    nodeState={nodeState}
                                />
                            );
                        }

                        if (item.kind === 'dropdown' && item.preferredStyle === 'icons') {
                            return (
                                <IconListWrapper
                                    input={item}
                                    key={key}
                                    nodeState={nodeState}
                                />
                            );
                        }

                        return '<unsupported>';
                    })}
                </Box>
            </WithoutLabel>
        </InputContainer>
    );
});
