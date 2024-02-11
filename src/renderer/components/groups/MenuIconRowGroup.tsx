import { Box } from '@chakra-ui/react';
import { memo } from 'react';
import { getUniqueKey } from '../../../common/group-inputs';
import { IconList } from '../inputs/elements/IconList';
import { InputContainer, WithoutLabel } from '../inputs/InputContainer';
import { IconSet } from './IconSetGroup';
import { GroupProps } from './props';

export const MenuIconRowGroup = memo(({ inputs, nodeState }: GroupProps<'menu-icon-row'>) => {
    return (
        <InputContainer>
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
                                <IconList
                                    isDisabled={nodeState.isLocked}
                                    key={key}
                                    options={item.options}
                                    reset={() => nodeState.setInputValue(item.id, item.def)}
                                    value={nodeState.inputData[item.id]}
                                    onChange={(value) => nodeState.setInputValue(item.id, value)}
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
