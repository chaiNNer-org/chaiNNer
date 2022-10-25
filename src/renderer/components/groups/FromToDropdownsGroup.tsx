import { Box, HStack, Text, VStack } from '@chakra-ui/react';
import { memo, useCallback } from 'react';
import { IoMdArrowForward } from 'react-icons/io';
import { useContext } from 'use-context-selector';
import { Input, InputData, OfKind } from '../../../common/common-types';
import { GlobalContext } from '../../contexts/GlobalNodeState';
import { DropDownInput } from '../inputs/DropDownInput';
import { InputContainer } from '../inputs/InputContainer';
import { GroupProps } from './props';

interface DropDownProps {
    nodeId: string;
    input: OfKind<Input, 'dropdown'>;
    inputData: InputData;
    isLocked: boolean;
}
const DropDown = memo(({ nodeId, input, inputData, isLocked }: DropDownProps) => {
    const { getNodeInputValue, setNodeInputValue } = useContext(GlobalContext);

    const value = getNodeInputValue<string | number>(input.id, inputData);
    const setValue = useCallback(
        (data: string | number) => setNodeInputValue(nodeId, input.id, data),
        [setNodeInputValue, nodeId, input.id]
    );

    return (
        <Box w="7.5em">
            <DropDownInput
                input={input}
                isLocked={isLocked}
                setValue={setValue}
                value={value}
            />
        </Box>
    );
});

export const FromToDropdownsGroup = memo(
    ({ inputs, inputData, isLocked, nodeId }: GroupProps<'from-to-dropdowns'>) => {
        const [from, to] = inputs;

        return (
            <InputContainer
                generic
                optional={false}
            >
                <VStack
                    mb={2}
                    spacing={0}
                >
                    <HStack w="full">
                        <Text
                            fontSize="xs"
                            lineHeight="0.9rem"
                            p={1}
                            textAlign="center"
                            w="full"
                        >
                            {from.label}
                        </Text>
                        <Text
                            fontSize="xs"
                            lineHeight="0.9rem"
                            p={1}
                            textAlign="center"
                            w="full"
                        >
                            {to.label}
                        </Text>
                    </HStack>
                    <HStack w="full">
                        <DropDown
                            input={from}
                            inputData={inputData}
                            isLocked={isLocked}
                            nodeId={nodeId}
                        />
                        <Box>
                            <IoMdArrowForward />
                        </Box>
                        <DropDown
                            input={to}
                            inputData={inputData}
                            isLocked={isLocked}
                            nodeId={nodeId}
                        />
                    </HStack>
                </VStack>
            </InputContainer>
        );
    }
);
