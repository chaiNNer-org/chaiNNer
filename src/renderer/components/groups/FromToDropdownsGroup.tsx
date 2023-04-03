import { Box, HStack } from '@chakra-ui/react';
import { memo, useCallback } from 'react';
import { IoMdArrowForward } from 'react-icons/io';
import { useContext } from 'use-context-selector';
import { Input, InputData, OfKind } from '../../../common/common-types';
import { getInputValue } from '../../../common/util';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { DropDown } from '../inputs/elements/Dropdown';
import { InputContainer } from '../inputs/InputContainer';
import { GroupProps } from './props';

interface SmallDropDownProps {
    nodeId: string;
    input: OfKind<Input, 'dropdown'>;
    inputData: InputData;
    isLocked: boolean;
}
const SmallDropDown = memo(({ nodeId, input, inputData, isLocked }: SmallDropDownProps) => {
    const { setNodeInputValue } = useContext(GlobalContext);

    const value = getInputValue<string | number>(input.id, inputData);
    const setValue = useCallback(
        (data?: string | number) => setNodeInputValue(nodeId, input.id, data ?? input.def),
        [setNodeInputValue, nodeId, input]
    );

    return (
        <Box w="full">
            <DropDown
                isDisabled={isLocked}
                options={input.options}
                reset={setValue}
                value={value}
                onChange={setValue}
            />
        </Box>
    );
});

export const FromToDropdownsGroup = memo(
    ({ inputs, inputData, isLocked, nodeId }: GroupProps<'from-to-dropdowns'>) => {
        const [from, to] = inputs;

        return (
            <InputContainer>
                <HStack
                    mb={2}
                    mt={2}
                    w="full"
                >
                    <SmallDropDown
                        input={from}
                        inputData={inputData}
                        isLocked={isLocked}
                        nodeId={nodeId}
                    />
                    <Box>
                        <IoMdArrowForward />
                    </Box>
                    <SmallDropDown
                        input={to}
                        inputData={inputData}
                        isLocked={isLocked}
                        nodeId={nodeId}
                    />
                </HStack>
            </InputContainer>
        );
    }
);
